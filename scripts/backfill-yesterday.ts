/**
 * 清除测试数据 + 回填昨天的真实推文
 *
 * 用法：
 *   npm run backfill
 *
 * 功能：
 *   1. 删除所有 manual_ 开头的测试推文（及关联记录）
 *   2. 爬取 @aleabitoreddit 昨天（CST/CDT）的所有推文
 *   3. AI 分析 + 存入数据库（不推送到微信，避免一次性轰炸）
 *   4. 打印结果，告诉你爬到了哪些帖子
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { fetchLatestTweets } from "@/lib/twitter";
import { handleTweet } from "@/lib/pipeline";

const TWITTER_USERNAME = process.env.TWITTER_USERNAME ?? "aleabitoreddit";

// ─── 计算昨天的 CDT 时间范围（5月是夏令时 UTC-5）──────────────────────────────

function getYesterdayRangeCST(): { start: Date; end: Date } {
  // 当前 UTC 时间
  const nowUtc = new Date();

  // 确定中部时区偏移（夏令时 CDT = UTC-5，冬令时 CST = UTC-6）
  // 简单判断：3月第二个周日 ~ 11月第一个周日 是 CDT
  const month = nowUtc.getUTCMonth() + 1; // 1-12
  const isDST = month >= 3 && month <= 11; // 简化判断，精确到月即可
  const offsetHours = isDST ? 5 : 6; // CDT = UTC-5 → offsetHours=5

  // 今天凌晨 00:00 CST（对应 UTC）
  const todayMidnightCSTinUTC = new Date(nowUtc);
  todayMidnightCSTinUTC.setUTCHours(offsetHours, 0, 0, 0); // 今天 00:00 CST
  // 如果当前 UTC 时间还没到 offsetHours 点，说明本地 CST 还是"昨天"
  if (nowUtc.getUTCHours() < offsetHours) {
    todayMidnightCSTinUTC.setUTCDate(todayMidnightCSTinUTC.getUTCDate() - 1);
  }

  const yesterdayStart = new Date(todayMidnightCSTinUTC);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1); // 昨天 00:00 CST

  const yesterdayEnd = new Date(todayMidnightCSTinUTC); // 今天 00:00 CST = 昨天结束

  return { start: yesterdayStart, end: yesterdayEnd };
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n============================================================");
  console.log("  Serenity 清库 + 昨日推文回填");
  console.log("============================================================\n");

  // ── Step 1: 删除测试推文 ──────────────────────────────────────────────────
  console.log("▸ Step 1: 清除测试数据...");
  const deleted = await prisma.tweet.deleteMany({
    where: { tweetId: { startsWith: "manual_" } }
  });
  console.log(`  ✓ 已删除 ${deleted.count} 条测试推文（关联记录一并清除）\n`);

  // ── Step 2: 确定爬取范围 ─────────────────────────────────────────────────
  const { start, end } = getYesterdayRangeCST();
  console.log("▸ Step 2: 确定爬取时间范围（美国中部时间昨天全天）");
  console.log(`  开始: ${start.toISOString()} (UTC)`);
  console.log(`  结束: ${end.toISOString()} (UTC)\n`);

  // ── Step 3: 调用 Twitter API ─────────────────────────────────────────────
  console.log(`▸ Step 3: 爬取 @${TWITTER_USERNAME} 昨天的推文...`);
  console.log("  （1次用户查询 + 1-2次时间线查询，共约2-3次API调用）\n");

  let tweets;
  try {
    tweets = await fetchLatestTweets({
      username: TWITTER_USERNAME,
      startTime: start,
      endTime: end,
      includeReplies: false,
      includeRetweets: false,
      maxResults: 100 // 一次性拉完，最多1次时间线调用
    });
  } catch (err) {
    console.error("  ❌ Twitter API 调用失败:", err);
    process.exit(1);
  }

  if (tweets.length === 0) {
    console.log("  ⚠ 昨天没有找到推文（可能账号未发帖，或时间范围有误）");
    await prisma.$disconnect();
    return;
  }

  console.log(`  ✓ 获取到 ${tweets.length} 条推文\n`);

  // ── Step 4: 逐条分析 + 推送微信 ─────────────────────────────────────────
  console.log("▸ Step 4: AI 分析 + WxPusher 推送...\n");

  let analyzed = 0, pushed = 0, skipped = 0;

  for (const tweet of tweets) {
    process.stdout.write(`  ⏳ ${tweet.tweetId}...`);
    const r = await handleTweet(tweet);
    const status = r.skipped ? "⏭ 跳过" : r.pushed ? "✅ 已推送" : "⚠ 分析完未推送";
    console.log(` ${status}`);
    if (r.analyzed) analyzed++;
    if (r.pushed) pushed++;
    if (r.skipped) skipped++;
  }

  // ── Step 5: 更新 WatchUser lastTweetId ──────────────────────────────────
  if (tweets.length > 0) {
    const newest = tweets[tweets.length - 1];
    await prisma.watchUser.updateMany({
      where: { username: TWITTER_USERNAME },
      data: { lastTweetId: newest.tweetId }
    });
    console.log(`\n  ✓ 已更新 lastTweetId → ${newest.tweetId}（下次自动爬取从这里续上）`);
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`  完成！分析 ${analyzed} 条，推送 ${pushed} 条，跳过 ${skipped} 条`);
  console.log("────────────────────────────────────────────────────────────\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
