import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import type { TweetInput } from "@/types";

type TwitterUserResponse = {
  data?: { id: string; username: string; name: string };
};

type TwitterTweetsResponse = {
  data?: Array<{
    id: string;
    text: string;
    created_at: string;
    referenced_tweets?: Array<{ type: "retweeted" | "quoted" | "replied_to"; id: string }>;
  }>;
  meta?: { newest_id?: string; result_count: number };
};

export async function fetchLatestTweets(params: {
  username: string;
  sinceId?: string | null;
  includeReplies?: boolean;
  includeRetweets?: boolean;
  maxResults?: number;
}): Promise<TweetInput[]> {
  if (!env.TWITTER_BEARER_TOKEN) {
    // No token yet — skip silently instead of crashing the pipeline
    return [];
  }

  const user = await fetchTwitterUser(params.username);
  const url = new URL(`https://api.twitter.com/2/users/${user.id}/tweets`);
  url.searchParams.set("tweet.fields", "created_at,referenced_tweets");
  url.searchParams.set("max_results", String(Math.min(Math.max(params.maxResults ?? 10, 5), 100)));
  if (params.sinceId) url.searchParams.set("since_id", params.sinceId);

  const exclude: string[] = [];
  if (!params.includeReplies) exclude.push("replies");
  if (!params.includeRetweets) exclude.push("retweets");
  if (exclude.length > 0) url.searchParams.set("exclude", exclude.join(","));

  const data = await fetchJson<TwitterTweetsResponse>(url.toString(), {
    headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` }
  });

  return (data.data ?? [])
    .filter((tweet) => {
      if (params.includeRetweets) return true;
      return !tweet.referenced_tweets?.some((ref) => ref.type === "retweeted");
    })
    .map((tweet) => ({
      tweetId: tweet.id,
      authorUsername: user.username,
      content: tweet.text,
      tweetCreatedAt: new Date(tweet.created_at),
      sourceUrl: `https://x.com/${user.username}/status/${tweet.id}`
    }))
    .sort((a, b) => a.tweetCreatedAt.getTime() - b.tweetCreatedAt.getTime());
}

async function fetchTwitterUser(username: string) {
  const user = await fetchJson<TwitterUserResponse>(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}`,
    { headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` } }
  );
  if (!user.data) throw new Error(`Twitter user not found: ${username}`);
  return user.data;
}
