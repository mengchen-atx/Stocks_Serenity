/**
 * X Filtered Stream daemon — connects to X Filtered Stream and forwards tweets
 * to the Vercel ingest endpoint in real time.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/stream-daemon.ts
 *
 * Required env vars:
 *   TWITTER_BEARER_TOKEN   — X app-level Bearer Token
 *   APP_BASE_URL           — e.g. https://www.alphaline.fit
 *   CRON_SECRET            — shared secret for /api/stream/ingest auth
 *   DATABASE_URL           — Supabase/PostgreSQL connection string
 *
 * The daemon will:
 *   1. Load enabled WatchUsers from DB and sync X stream rules
 *   2. Open a persistent SSE connection to X Filtered Stream
 *   3. Forward each tweet to APP_BASE_URL/api/stream/ingest
 *   4. Reconnect with exponential backoff on any failure
 *   5. Re-sync rules every 5 minutes in case WatchUsers changed
 */

import { prisma } from "@/lib/prisma";
import { syncStreamRules } from "@/lib/stream-rules";

// ── Env validation ────────────────────────────────────────────────────────────

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN ?? "";
const APP_BASE_URL = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET ?? "";

if (!BEARER_TOKEN) {
  console.error("[daemon] TWITTER_BEARER_TOKEN is not set — exiting");
  process.exit(1);
}
if (!APP_BASE_URL) {
  console.error("[daemon] APP_BASE_URL is not set — exiting");
  process.exit(1);
}
if (!CRON_SECRET) {
  console.warn("[daemon] CRON_SECRET is not set — ingest endpoint will accept unauthenticated requests");
}

const INGEST_URL = `${APP_BASE_URL}/api/stream/ingest`;

// ── Stream endpoint ───────────────────────────────────────────────────────────
// Request all fields needed for text cleaning, media expansion, and author lookup.
// No lang/reply/retweet filters — WatchUser settings control that on the Vercel side.

const STREAM_URL =
  "https://api.twitter.com/2/tweets/search/stream" +
  "?tweet.fields=created_at,referenced_tweets,attachments,note_tweet,entities" +
  "&expansions=author_id,attachments.media_keys" +
  "&user.fields=username,name" +
  "&media.fields=url,preview_image_url,type";

// ── Tunables ──────────────────────────────────────────────────────────────────

const RULE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;  // re-check DB for rule changes every 5 min
const HEARTBEAT_TIMEOUT_MS = 40_000;              // X sends a blank line every 20s; abort at 40s
const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 300_000;                   // 5 minutes max between retries

// ── State ─────────────────────────────────────────────────────────────────────

let shuttingDown = false;
let currentController: AbortController | null = null;

// ── Graceful shutdown ─────────────────────────────────────────────────────────

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[daemon] Shutdown signal received — closing stream…");
  currentController?.abort();
  // Give in-flight ingest POSTs a moment to settle
  setTimeout(async () => {
    await prisma.$disconnect();
    process.exit(0);
  }, 3_000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getEnabledUsernames(): Promise<string[]> {
  const users = await prisma.watchUser.findMany({
    where: { enabled: true },
    select: { username: true },
    orderBy: { username: "asc" },
  });
  return users.map((u) => u.username);
}

async function forwardTweet(rawEvent: unknown, tweetId: string): Promise<void> {
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify(rawEvent),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ingest POST failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { ok?: boolean; skipped?: string; accepted?: boolean };
  if (data.skipped) {
    console.log(`[daemon] #${tweetId} skipped by ingest: ${data.skipped}`);
  } else if (data.accepted) {
    console.log(`[daemon] #${tweetId} accepted for processing`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main stream loop ──────────────────────────────────────────────────────────

async function runStreamLoop(): Promise<void> {
  let attempt = 0;
  let lastUsernames: string[] = [];
  let lastRuleRefresh = 0;

  while (!shuttingDown) {
    // Exponential backoff between reconnects (skip on first attempt)
    if (attempt > 0) {
      const backoffMs = Math.min(MIN_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
      console.log(`[daemon] Reconnecting in ${Math.round(backoffMs / 1000)}s (attempt #${attempt})…`);
      await sleep(backoffMs);
      if (shuttingDown) break;
    }

    // ── Sync stream rules if WatchUsers changed or first run ────────────────
    if (Date.now() - lastRuleRefresh > RULE_REFRESH_INTERVAL_MS || attempt === 0) {
      try {
        const usernames = await getEnabledUsernames();
        const usernamesKey = usernames.join(",");
        const lastKey = lastUsernames.join(",");

        if (usernamesKey !== lastKey || lastRuleRefresh === 0) {
          console.log(`[daemon] Syncing stream rules for ${usernames.length} user(s): ${usernames.join(", ")}`);
          await syncStreamRules(usernames, BEARER_TOKEN);
          lastUsernames = usernames;
        }
        lastRuleRefresh = Date.now();
      } catch (err) {
        console.error(
          "[daemon] Rule sync failed:",
          err instanceof Error ? err.message : String(err)
        );
        // Don't abort — stream may still work with existing rules
      }
    }

    if (shuttingDown) break;

    // ── Open stream connection ───────────────────────────────────────────────
    const controller = new AbortController();
    currentController = controller;

    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        console.warn(`[daemon] No data for ${HEARTBEAT_TIMEOUT_MS / 1000}s — reconnecting`);
        controller.abort();
      }, HEARTBEAT_TIMEOUT_MS);
    };

    try {
      console.log("[daemon] Connecting to X Filtered Stream…");
      const res = await fetch(STREAM_URL, {
        headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();

        if (res.status === 429) {
          // Rate limited — jump to max backoff
          console.error(`[daemon] Rate limited (429) — backing off ${MAX_BACKOFF_MS / 1000}s`);
          attempt = Math.ceil(Math.log2(MAX_BACKOFF_MS / MIN_BACKOFF_MS)) + 1;
        } else if (res.status === 403) {
          // Likely plan doesn't support Filtered Stream — exit rather than loop forever
          console.error(`[daemon] 403 Forbidden — check X API plan supports Filtered Stream. Body: ${text}`);
          process.exit(1);
        } else {
          console.error(`[daemon] Stream HTTP ${res.status}: ${text.slice(0, 300)}`);
          attempt++;
        }
        continue;
      }

      console.log("[daemon] Stream connected — waiting for events…");
      attempt = 0; // reset backoff on successful connection
      resetHeartbeat();

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";

      while (!shuttingDown) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[daemon] Stream closed by server");
          break;
        }

        resetHeartbeat();
        lineBuffer += decoder.decode(value, { stream: true });

        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? ""; // keep partial last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue; // blank line = X heartbeat, ignore

          let event: unknown;
          try {
            event = JSON.parse(trimmed);
          } catch {
            console.warn("[daemon] Unparseable stream line:", trimmed.slice(0, 120));
            continue;
          }

          const tweetId = (event as { data?: { id?: string } }).data?.id;
          const authorUsers = (event as { includes?: { users?: Array<{ username?: string }> } })
            .includes?.users;
          const authorUsername = authorUsers?.[0]?.username ?? "unknown";

          if (!tweetId) continue; // non-tweet event (errors, disconnect notices)

          console.log(
            `[daemon] Tweet received: @${authorUsername} #${tweetId} — forwarding to ingest`
          );

          // Fire-and-forget; errors are logged but don't crash the stream loop
          forwardTweet(event, tweetId).catch((err) => {
            console.error(
              `[daemon] Failed to forward #${tweetId}:`,
              err instanceof Error ? err.message : String(err)
            );
          });
        }
      }

      reader.cancel();

    } catch (err) {
      if (shuttingDown) break;

      const msg = err instanceof Error ? err.message : String(err);

      // AbortError = heartbeat timeout (expected) — don't log as error
      if (err instanceof Error && err.name === "AbortError") {
        // message already printed by the heartbeat timer
      } else {
        console.error("[daemon] Stream connection error:", msg);
      }

      attempt++;
    } finally {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      currentController = null;
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

console.log("[daemon] X Filtered Stream daemon starting");
console.log(`[daemon] Ingest URL: ${INGEST_URL}`);

runStreamLoop()
  .then(() => {
    console.log("[daemon] Exited cleanly");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[daemon] Fatal error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
