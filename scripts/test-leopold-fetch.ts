/**
 * 测试能否拿到 @leopoldasch 的推文
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchLatestTweets } from "../lib/twitter";

async function main() {
  console.log("🔍 测试爬取 @leopoldasch 最新推文（不限时间）...\n");

  const tweets = await fetchLatestTweets({
    username: "leopoldasch",
    includeReplies: false,
    includeRetweets: false,
    maxResults: 10,
  });

  if (tweets.length === 0) {
    console.log("❌ 没有拿到任何推文");
    console.log("   可能原因：账号不存在 / 账号私密 / API 权限不足 / 最近没发帖");
    return;
  }

  console.log(`✅ 拿到 ${tweets.length} 条推文：\n`);
  for (const t of tweets) {
    console.log(`[${t.tweetCreatedAt?.toISOString() ?? "?"}] ${t.tweetId}`);
    console.log(`  ${t.content.slice(0, 120)}...`);
    console.log();
  }
}

main().catch(console.error);
