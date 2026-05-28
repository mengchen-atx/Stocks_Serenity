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
    attachments?: { media_keys?: string[] };
  }>;
  includes?: {
    media?: Array<{
      media_key: string;
      type: "photo" | "video" | "animated_gif";
      url?: string;             // photo 有直链
      preview_image_url?: string; // video/gif 有预览图
    }>;
  };
  meta?: { newest_id?: string; result_count: number };
};

export async function fetchLatestTweets(params: {
  username: string;
  sinceId?: string | null;
  /** 爬取起始时间（包含），用于历史回填 */
  startTime?: Date;
  /** 爬取结束时间（不包含），用于历史回填 */
  endTime?: Date;
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
  url.searchParams.set("tweet.fields", "created_at,referenced_tweets,attachments");
  url.searchParams.set("expansions", "attachments.media_keys");
  url.searchParams.set("media.fields", "url,preview_image_url,type");
  url.searchParams.set("max_results", String(Math.min(Math.max(params.maxResults ?? 10, 5), 100)));

  if (params.sinceId) url.searchParams.set("since_id", params.sinceId);
  if (params.startTime) url.searchParams.set("start_time", params.startTime.toISOString());
  if (params.endTime) url.searchParams.set("end_time", params.endTime.toISOString());

  const exclude: string[] = [];
  if (!params.includeReplies) exclude.push("replies");
  if (!params.includeRetweets) exclude.push("retweets");
  if (exclude.length > 0) url.searchParams.set("exclude", exclude.join(","));

  const data = await fetchJson<TwitterTweetsResponse>(url.toString(), {
    headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` }
  });

  // 建立 media_key → URL 映射
  const mediaMap = new Map<string, string>();
  for (const m of data.includes?.media ?? []) {
    const imgUrl = m.url ?? m.preview_image_url;
    if (imgUrl) mediaMap.set(m.media_key, imgUrl);
  }

  return (data.data ?? [])
    .filter((tweet) => {
      if (params.includeRetweets) return true;
      return !tweet.referenced_tweets?.some((ref) => ref.type === "retweeted");
    })
    .map((tweet) => {
      const imageUrls = (tweet.attachments?.media_keys ?? [])
        .map((k) => mediaMap.get(k))
        .filter((u): u is string => !!u);
      return {
        tweetId: tweet.id,
        authorUsername: user.username,
        content: tweet.text,
        tweetCreatedAt: new Date(tweet.created_at),
        sourceUrl: `https://x.com/${user.username}/status/${tweet.id}`,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined
      };
    })
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
