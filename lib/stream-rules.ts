// Manages X Filtered Stream rules — idempotent sync from WatchUser username list.
// Builds `from:user1 OR from:user2 OR ...` chunks, each ≤ 512 chars (X API limit).

const RULES_URL = "https://api.twitter.com/2/tweets/search/stream/rules";
const RULE_TAG = "serenity-auto";
const MAX_RULE_VALUE_LENGTH = 512;

type StreamRule = { id: string; value: string; tag?: string };
type RulesResponse = { data?: StreamRule[] };
type UpdateBody = {
  delete?: { ids: string[] };
  add?: { value: string; tag: string }[];
};

export async function syncStreamRules(
  usernames: string[],
  bearerToken: string
): Promise<void> {
  const desired = buildRuleValues(usernames);
  const existing = await getExistingRules(bearerToken);

  const existingValues = new Set(existing.map((r) => r.value));
  const desiredValues = new Set(desired);

  const toDelete = existing.filter((r) => !desiredValues.has(r.value));
  const toAdd = desired.filter((v) => !existingValues.has(v));

  if (toDelete.length === 0 && toAdd.length === 0) {
    console.log(`[stream-rules] No changes — ${existing.length} rule(s) in place`);
    return;
  }

  const body: UpdateBody = {};
  if (toDelete.length > 0) body.delete = { ids: toDelete.map((r) => r.id) };
  if (toAdd.length > 0) body.add = toAdd.map((v) => ({ value: v, tag: RULE_TAG }));

  const res = await fetch(RULES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rule update failed: HTTP ${res.status} — ${text}`);
  }

  const data = (await res.json()) as { meta?: { summary?: Record<string, number> } };
  const summary = data.meta?.summary ?? {};
  console.log(
    `[stream-rules] Synced: +${toAdd.length} added, -${toDelete.length} deleted`,
    JSON.stringify(summary)
  );
  if (toAdd.length > 0) {
    console.log(`[stream-rules] New rules: ${toAdd.join(" | ")}`);
  }
}

export async function getExistingRules(bearerToken: string): Promise<StreamRule[]> {
  const res = await fetch(RULES_URL, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch rules: HTTP ${res.status} — ${text}`);
  }
  const data = (await res.json()) as RulesResponse;
  return data.data ?? [];
}

// Splits usernames into `from:a OR from:b OR ...` strings, each ≤ 512 chars.
function buildRuleValues(usernames: string[]): string[] {
  const chunks: string[] = [];
  let parts: string[] = [];

  for (const username of usernames) {
    const token = `from:${username}`;
    const candidate =
      parts.length === 0 ? token : `${parts.join(" OR ")} OR ${token}`;
    if (candidate.length > MAX_RULE_VALUE_LENGTH) {
      if (parts.length > 0) chunks.push(parts.join(" OR "));
      parts = [token];
    } else {
      parts.push(token);
    }
  }

  if (parts.length > 0) chunks.push(parts.join(" OR "));
  return chunks;
}
