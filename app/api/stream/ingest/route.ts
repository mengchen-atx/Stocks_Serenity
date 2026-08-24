import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { handleTweet } from "@/lib/pipeline";
import { parseStreamEvent } from "@/lib/twitter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseStreamEvent(body);
  if (!parsed) {
    // Heartbeat or non-tweet event — not an error
    return NextResponse.json({ ok: true, skipped: "non-tweet event" });
  }

  const { tweet, authorUsername, isRetweet } = parsed;

  // Look up WatchUser — needed for reply/retweet filters and channel routing
  const watchUser = await prisma.watchUser.findFirst({
    where: { username: { equals: authorUsername, mode: "insensitive" }, enabled: true },
    include: { channel: { select: { id: true, wxpusherTopicId: true } } },
  });

  if (!watchUser) {
    logger.warn({ authorUsername }, "stream ingest: no matching enabled WatchUser");
    return NextResponse.json({ ok: true, skipped: `no WatchUser for @${authorUsername}` });
  }

  // Apply per-user filters (stream rules intentionally don't filter these)
  if (!watchUser.includeRetweets && isRetweet) {
    return NextResponse.json({ ok: true, skipped: "retweet filtered" });
  }
  if (!watchUser.includeReplies && /^@\w+/.test(tweet.content.trimStart())) {
    return NextResponse.json({ ok: true, skipped: "reply filtered" });
  }

  const channelTopicId = watchUser.channel?.wxpusherTopicId ?? null;

  // Respond immediately — process in background so daemon isn't blocked by AI latency
  waitUntil(
    handleTweet(
      tweet,
      watchUser.id,
      watchUser.channelId ?? undefined,
      channelTopicId,
      watchUser.displayName ?? undefined
    ).then((result) => {
      logger.info(
        { tweetId: tweet.tweetId, authorUsername, ...result },
        "stream ingest: tweet handled"
      );
    }).catch((err) => {
      logger.error({ err, tweetId: tweet.tweetId, authorUsername }, "stream ingest: handleTweet failed");
    })
  );

  return NextResponse.json({ ok: true, accepted: true, tweetId: tweet.tweetId });
}
