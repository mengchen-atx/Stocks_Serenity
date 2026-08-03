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
 * 把推文正文里的 t.co 短链处理掉：
 * - 图片/媒体附件链接 (pic.twitter.com, pic.x.com) -> 直接删除，图片单独展示
 * - 其余链接 -> 替换为 display_url（可读缩略形式，如 example.com/arti... 或 2577.HK）
 *
 * 注意：X 会把形似域名的纯文本（如股票代码 "2577.HK"、"300376.SZ"，因为 .HK/.SZ
 * 恰好是合法顶级域名）自动转换成 t.co 短链。如果只用正则把 t.co 链接整个删掉，
 * 会连这些被误判的股票代码本身也一起删掉（推文原文里这种代码并没有 $ 前缀）。
 * 所以必须依赖 entities.urls 里的 display_url 做精确替换，而不是粗暴删除。
 */
function cleanTweetText(text: string, urls: UrlEntity[] = []): string {
  let result = text;

  for (const u of urls) {
    const isMediaPreview = /^pic\.(twitter\.com|x\.com)\//.test(u.display_url);
    result = result.split(u.url).join(isMediaPreview ? "" : u.display_url);
  }

  // 兜底：清理 entities 未覆盖到的残留 t.co 短链（理论上不应再有）
  result = result.replace(/https?:\/\/t\.co\/\S+/g, "");

  // 规范化空白：保留作者的换行排版（一行一个股票），只压缩行内多余空格。
  // 不能用 \s{2,} 整体压缩——很多行末尾带一个空格，"...B \n2. ..." 会被
  // 误判为连续空白合并成一行，导致多个条目挤在同一行。
  return result
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchLatestTweets(params: {
  username: string;
  /** 已缓存的 Twitter user ID，提供时跳过 username→ID 查询，节省一次 API 调用 */
  cachedUserId?: string | null;
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

  const user = params.cachedUserId
    ? { id: params.cachedUserId, username: params.username }
    : await fetchTwitterUser(params.username);

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
        // 过滤转推
        if (!params.includeRetweets &&
            tweet.referenced_tweets?.some((ref) => ref.type === "retweeted")) return false;
        // 二道保险：过滤 reply（正文以 @用户名 开头）
        // Twitter API exclude=replies 有时漏网，这里兜底
        if (!params.includeReplies && /^@\w+/.test(tweet.text.trimStart())) return false;
        return true;
      })
      .map((tweet) => {
        const imageUrls = (tweet.attachments?.media_keys ?? [])
          .map((k) => mediaMap.get(k))
          .filter((u): u is string => !!u);

        // note_tweet.text 是长推文完整正文，优先使用；entities 也要用对应来源的
        const rawText = tweet.note_tweet?.text ?? tweet.text;
        const urlEntities = tweet.note_tweet?.entities?.urls ?? tweet.entities?.urls ?? [];
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
