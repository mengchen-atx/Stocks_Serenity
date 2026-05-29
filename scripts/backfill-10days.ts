/**
 * 回填最近10天的推文
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/backfill-10days.ts
 *
 * 功能：
 *   1. 爬取 @aleabitoreddit 最近10天的所有推文（含图片）
 *   2. 自动分页，不受100条限制
 *   3. 重复的推文自动跳过（contentHash 去重）
 *   4. 每条 AI 分析 + WxPusher 推送
 *   5. 更新 lastTweetId，下次定时任务从此续上
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { fetchLatestTweets } from "@/lib/twitter";
import { handleTweet } from "@/lib/pipeline";

const TWITTER_USERNAME = process.env.TWITTER_USERNAME ?? "aleabitoreddit";
const DAYS = 10;

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n============================================================");
  console.log(`  Serenity 回填 — 最近 ${DAYS} 天推文`);
  console.log("============================================================\n");

  // ── 计算时间范围 ────────────────────────────────────────────────────────────
  const endTime = new Date();                              // 当前时刻
  const startTime = new Date(endTime.getTime() - DAYS * 24 * 60 * 60 * 1000);

  console.log(`▸ 爬取时间范围`);
  console.log(`  开始: ${startTime.toISOString()}  (${formatCST(startTime)} CST)`);
  console.log(`  结束: ${endTime.toISOString()}  (${formatCST(endTime)} CST)\n`);

  // ── 调用 Twitter API（自动分页）──────────────────────────────────────────────
  console.log(`▸ 爬取 @${TWITTER_USERNAME} 最近 ${DAYS} 天的推文...`);
  console.log("  （使用分页，max_results=100/页）\n");

  let tweets;
  try {
    tweets = await fetchLatestTweets({
      username: TWITTER_USERNAME,
      startTime,
      endTime,
      includeReplies: false,
      includeRetweets: false,
      maxResults: 100
    });
  } catch (err) {
    console.error("  ❌ Twitter API 调用失败:", err);
    process.exit(1);
  }

  if (tweets.length === 0) {
    console.log(`  ⚠ 最近 ${DAYS} 天没有找到推文`);
    await prisma.$disconnect();
    return;
  }

  console.log(`  ✓ 共获取 ${tweets.length} 条推文\n`);

  // ── 图片统计 ────────────────────────────────────────────────────────────────
  const withImages = tweets.filter((t) => t.imageUrls && t.imageUrls.length > 0);
  console.log(`  📷 含图片: ${withImages.length} 条 / 纯文字: ${tweets.length - withImages.length} 条\n`);

  // ── 逐条分析 + 推送 ─────────────────────────────────────────────────────────
  console.log("▸ AI 分析 + WxPusher 推送...\n");

  let analyzed = 0, pushed = 0, skipped = 0, failed = 0;

  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];
    const timeStr = formatCST(tweet.tweetCreatedAt);
    const imgTag = tweet.imageUrls?.length ? ` 🖼${tweet.imageUrls.length}` : "";
    process.stdout.write(`  [${i + 1}/${tweets.length}] ${timeStr}${imgTag} → `);

    try {
      const r = await handleTweet(tweet);
      if (r.skipped) {
        console.log("⏭ 已存在，跳过");
        skipped++;
      } else if (r.pushed) {
        console.log("✅ 已推送");
        pushed++;
        if (r.analyzed) analyzed++;
      } else {
        console.log("💾 已分析（未推送）");
        if (r.analyzed) analyzed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 数据库连接断开时重连后重试一次
      if (msg.includes("Closed") || msg.includes("connection") || msg.includes("timed out")) {
        console.log(`⚠ 连接断开，重连后重试...`);
        try {
          await prisma.$disconnect();
          await prisma.$connect();
          const r = await handleTweet(tweet);
          if (r.skipped) { console.log("⏭ 重试：已存在，跳过"); skipped++; }
          else if (r.pushed) { console.log("✅ 重试：已推送"); pushed++; if (r.analyzed) analyzed++; }
          else { console.log("💾 重试：已分析"); if (r.analyzed) analyzed++; }
        } catch (retryErr) {
          console.log(`❌ 重试也失败: ${retryErr instanceof Error ? retryErr.message : retryErr}`);
          failed++;
        }
      } else {
        console.log(`❌ 失败: ${msg}`);
        failed++;
      }
    }
  }

  // ── 更新 lastTweetId ────────────────────────────────────────────────────────
  const newest = tweets[tweets.length - 1];
  if (newest) {
    await prisma.watchUser.updateMany({
      where: { username: TWITTER_USERNAME },
      data: { lastTweetId: newest.tweetId }
    });
    console.log(`\n  ✓ 已更新 lastTweetId → ${newest.tweetId}`);
  }

  // ── 汇总 ────────────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`  爬取: ${tweets.length} 条 | 分析: ${analyzed} 条 | 推送: ${pushed} 条 | 跳过: ${skipped} 条 | 失败: ${failed} 条`);
  console.log("────────────────────────────────────────────────────────────\n");

  await prisma.$disconnect();
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function formatCST(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
