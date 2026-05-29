import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import type { TweetInput } from "@/types";

type TwitterUserResponse = {
  data?: { id: string; username: string; name: string };
};

type UrlEntity = {
  url: string;           // t.co 短链（推文正文中出现的）
  expanded_url: string;  // 真实目标 URL
  display_url: string;   // 可读缩短版，如 "pic.twitter.com/abc" 或 "example.com/arti…"
};

type TwitterTweetsResponse = {
  data?: Array<{
    id: string;
    text: string;
    /** X Premium 长推文的完整正文，存在时优先使用，text 字段仅为截断预览 */
    note_tweet?: {
      text: string;
      entities?: { urls?: UrlEntity[] };
    };
    created_at: string;
    referenced_tweets?: Array<{ type: "retweeted" | "quoted" | "replied_to"; id: string }>;
    attachments?: { media_keys?: string[] };
    entities?: { urls?: UrlEntity[] };
  }>;
  includes?: {
    media?: Array<{
      media_key: string;
      type: "photo" | "video" | "animated_gif";
      url?: string;
      preview_image_url?: string;
    }>;
  };
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
};

// ─── URL 清理 ────────────────────────────────────────────────────────────────

/**
 * 把推文正文里的 t.co 短链替换掉：
 * - 图片/媒体附件链接 (pic.twitter.com, twitter.com photo 等) -> 直接删除，图片单独展示
 * - 真实外部链接 -> 替换为 display_url (可读缩略形式，如 example.com/arti...)
 * - 末尾多余空白 -> 修剪掉
 */
function cleanTweetText(text: string, urlEntities?: UrlEntity[]): string {
  if (!urlEntities || urlEntities.length === 0) return text.trim();

  let cleaned = text;
  for (const entity of urlEntities) {
    const isMedia =
      entity.display_url.startsWith("pic.twitter.com/") ||
      entity.expanded_url.includes("/photo/") ||
      entity.expanded_url.includes("/video/") ||
      entity.expanded_url.startsWith("https://twitter.com/i/") ||
      entity.expanded_url.startsWith("https://x.com/i/");

    if (isMedia) {
      cleaned = cleaned.replace(entity.url, "");
    } else {
      // 外部链接：用 display_url 替代（如 "example.com/article…"），更易读
      cleaned = cleaned.replace(entity.url, entity.display_url);
    }
  }

  // 清除多余的连续空格和末尾空白
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchLatestTweets(params: {
  username: string;
  sinceId?: string | null;
  startTime?: Date;
  endTime?: Date;
  includeReplies?: boolean;
  includeRetweets?: boolean;
  maxResults?: number;
}): Promise<TweetInput[]> {
  if (!env.TWITTER_BEARER_TOKEN) {
    return [];
  }

  const user = await fetchTwitterUser(params.username);

  const baseUrl = new URL(`https://api.twitter.com/2/users/${user.id}/tweets`);
  baseUrl.searchParams.set(
    "tweet.fields",
    "created_at,referenced_tweets,attachments,note_tweet,entities"
  );
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

  const allTweets: TweetInput[] = [];
  const mediaMap = new Map<string, string>();
  let paginationToken: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 20;

  do {
    const pageUrl = new URL(baseUrl.toString());
    if (paginationToken) pageUrl.searchParams.set("pagination_token", paginationToken);

    const data = await fetchJson<TwitterTweetsResponse>(pageUrl.toString(), {
      headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` }
    });

    for (const m of data.includes?.media ?? []) {
      const imgUrl = m.url ?? m.preview_image_url;
      if (imgUrl) mediaMap.set(m.media_key, imgUrl);
    }

    const pageTweets = (data.data ?? [])
      .filter((tweet) => {
        if (params.includeRetweets) return true;
        return !tweet.referenced_tweets?.some((ref) => ref.type === "retweeted");
      })
      .map((tweet) => {
        const imageUrls = (tweet.attachments?.media_keys ?? [])
          .map((k) => mediaMap.get(k))
          .filter((u): u is string => !!u);

        // note_tweet.text 是长推文完整正文，优先使用
        const rawText = tweet.note_tweet?.text ?? tweet.text;
        // 长推文用 note_tweet 的 URL entities；普通推文用 tweet 的 entities
        const urlEntities = tweet.note_tweet?.entities?.urls ?? tweet.entities?.urls;
        const content = cleanTweetText(rawText, urlEntities);

        return {
          tweetId: tweet.id,
          authorUsername: user.username,
          content,
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
