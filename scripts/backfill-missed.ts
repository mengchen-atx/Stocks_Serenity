/**
 * 补发欠费期间漏掉的推文
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/backfill-missed.ts [天数]
 *
 * 功能：
 *   1. 读取所有启用的 WatchUser（含 channel info）
 *   2. 爬取最近 N 天（默认 7 天）的推文
 *   3. AI 分析 + WxPusher 推送（含话题广播）
 *   4. handleTweet 内部去重，已推送的自动跳过
 *   5. 更新 lastTweetId
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { fetchLatestTweets } from "@/lib/twitter";
import { handleTweet } from "@/lib/pipeline";

const DAYS = parseInt(process.argv[2] ?? "7", 10);

function formatCST(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")} CST`;
}

async function main() {
  console.log("\n============================================================");
  console.log(`  Serenity 补发 — 最近 ${DAYS} 天漏推推文`);
  console.log("============================================================\n");

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - DAYS * 24 * 60 * 60 * 1000);

  console.log(`▸ 时间范围: ${formatCST(startTime)} → ${formatCST(endTime)}\n`);

  const users = await prisma.watchUser.findMany({
    where: { enabled: true },
    include: { channel: { select: { id: true, wxpusherTopicId: true, name: true } } },
  });

  if (users.length === 0) {
    console.error("❌ 没有找到启用的 WatchUser");
    process.exit(1);
  }

  let totalAnalyzed = 0, totalPushed = 0, totalSkipped = 0, totalFailed = 0;

  for (const user of users) {
    const channelTopicId = user.channel?.wxpusherTopicId ?? null;
    const channelId = user.channel?.id ?? user.channelId ?? null;
    const displayName = user.displayName ?? user.channel?.name ?? user.username;

    console.log(`\n📡 @${user.username}${channelTopicId ? ` [话题 ${channelTopicId}]` : " [无话题]"}`);

    let tweets;
    try {
      tweets = await fetchLatestTweets({
        username: user.username,
        startTime,
        endTime,
        includeReplies: user.includeReplies,
        includeRetweets: user.includeRetweets,
        maxResults: 100,
      });
    } catch (err) {
      console.error(`  ❌ Twitter API 失败: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    if (tweets.length === 0) {
      console.log(`  ⚠ 最近 ${DAYS} 天没有找到推文`);
      continue;
    }

    console.log(`  ✓ 获取到 ${tweets.length} 条推文\n`);

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      const timeStr = formatCST(tweet.tweetCreatedAt);
      const imgTag = tweet.imageUrls?.length ? ` 🖼${tweet.imageUrls.length}` : "";
      process.stdout.write(`  [${i + 1}/${tweets.length}] ${timeStr}${imgTag} → `);

      try {
        const r = await handleTweet(tweet, user.id, channelId ?? undefined, channelTopicId, displayName);
        if (r.skipped) {
          console.log("⏭ 已推送，跳过");
          totalSkipped++;
        } else if (r.pushed) {
          console.log("✅ 已补发");
          totalPushed++;
          if (r.analyzed) totalAnalyzed++;
        } else {
          console.log("💾 已分析（推送失败或无收件人）");
          if (r.analyzed) totalAnalyzed++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Closed") || msg.includes("connection") || msg.includes("timed out")) {
          console.log("⚠ 连接断开，重连重试...");
          try {
            await prisma.$disconnect();
            await prisma.$connect();
            const r = await handleTweet(tweet, user.id, channelId ?? undefined, channelTopicId, displayName);
            if (r.skipped) { console.log("⏭ 重试：跳过"); totalSkipped++; }
            else if (r.pushed) { console.log("✅ 重试：已补发"); totalPushed++; }
            else { console.log("💾 重试：已分析"); }
          } catch (e2) {
            console.log(`❌ 重试失败: ${e2 instanceof Error ? e2.message : e2}`);
            totalFailed++;
          }
        } else {
          console.log(`❌ 失败: ${msg}`);
          totalFailed++;
        }
      }
    }

    // 更新 lastTweetId，让 cron 从最新处续上
    const newest = tweets[tweets.length - 1];
    if (newest) {
      await prisma.watchUser.update({
        where: { id: user.id },
        data: { lastTweetId: newest.tweetId },
      });
      console.log(`\n  ✓ 已更新 lastTweetId → ${newest.tweetId}`);
    }
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`  补发完成：分析 ${totalAnalyzed} | 推送 ${totalPushed} | 跳过 ${totalSkipped} | 失败 ${totalFailed}`);
  console.log("════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
