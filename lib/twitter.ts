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
    /** X Premium 长推文的完整正文，存在时优先使用，text 字段仅为截断预览 */
    note_tweet?: { text: string };
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
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;  // 分页 token
  };
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

  // ── 基础查询参数（分页循环中复用）────────────────────────────────────────
  const baseUrl = new URL(`https://api.twitter.com/2/users/${user.id}/tweets`);
  // note_tweet 字段：X Premium 长推文的完整正文（超过 280 字时 text 字段仅为截断预览）
  baseUrl.searchParams.set("tweet.fields", "created_at,referenced_tweets,attachments,note_tweet");
  baseUrl.searchParams.set("expansions", "attachments.media_keys");
  baseUrl.searchParams.set("media.fields", "url,preview_image_url,type");
  baseUrl.searchParams.set("max_results", String(Math.min(Math.max(params.maxResults ?? 10, 5), 100)));

  if (params.sinceId) baseUrl.searchParams.set("since_id", params.sinceId);
  if (params.startTime) baseUrl.searchParams.set("start_time", params.startTime.toISOString());
  if (params.endTime) baseUrl.searchParams.set("end_time", params.endTime.toISOString());

  const exclude: string[] = [];
  if (!params.includeReplies) exclude.push("replies");
  if (!params.includeRetweets) exclude.push("retweets");
  if (exclude.length > 0) baseUrl.searchParams.set("exclude", exclude.join(","));

  // ── 分页循环，自动拉取全部页 ──────────────────────────────────────────────
  const allTweets: TweetInput[] = [];
  const mediaMap = new Map<string, string>();
  let paginationToken: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 20; // 安全上限，防止无限循环

  do {
    const pageUrl = new URL(baseUrl.toString());
    if (paginationToken) pageUrl.searchParams.set("pagination_token", paginationToken);

    const data = await fetchJson<TwitterTweetsResponse>(pageUrl.toString(), {
      headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` }
    });

    // 累积 media_key → URL 映射
    for (const m of data.includes?.media ?? []) {
      const imgUrl = m.url ?? m.preview_image_url;
      if (imgUrl) mediaMap.set(m.media_key, imgUrl);
    }

    // 处理本页推文
    const pageTweets = (data.data ?? [])
      .filter((tweet) => {
        if (params.includeRetweets) return true;
        return !tweet.referenced_tweets?.some((ref) => ref.type === "retweeted");
      })
      .map((tweet) => {
        const imageUrls = (tweet.attachments?.media_keys ?? [])
          .map((k) => mediaMap.get(k))
          .filter((u): u is string => !!u);
        // note_tweet.text 是 X Premium 长推文的完整正文
        // tweet.text 对长推文只是截断预览（末尾有 t.co 短链），优先使用 note_tweet.text
        const fullText = tweet.note_tweet?.text ?? tweet.text;
        return {
          tweetId: tweet.id,
          authorUsername: user.username,
          content: fullText,
          tweetCreatedAt: new Date(tweet.created_at),
          sourceUrl: `https://x.com/${user.username}/status/${tweet.id}`,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined
        };
      });

    allTweets.push(...pageTweets);
    paginationToken = data.meta?.next_token;
    pageCount++;

    if (paginationToken) {
      console.log(`  → 第${pageCount}页 ${pageTweets.length} 条，继续拉取下一页...`);
    }
  } while (paginationToken && pageCount < MAX_PAGES);

  // 按时间升序返回（最旧的先处理）
  return allTweets.sort((a, b) => a.tweetCreatedAt.getTime() - b.tweetCreatedAt.getTime());
}

async function fetchTwitterUser(username: string) {
  const user = await fetchJson<TwitterUserResponse>(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}`,
    { headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` } }
  );
  if (!user.data) throw new Error(`Twitter user not found: ${username}`);
  return user.data;
}
