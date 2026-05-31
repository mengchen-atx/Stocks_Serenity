/**
 * Leopold Aschenbrenner (@leopoldasch) 历史推文回填
 *
 * - 爬取过去 30 天的帖子（不含 reply / retweet）
 * - 绑定 leopold 频道，stock mentions 独立统计
 * - 不触发任何 WxPusher 推送
 *
 * 运行：npx tsx scripts/backfill-leopold.ts
 */

// 必须在所有 lib 导入之前加载 .env.local
// ESM 中 import 提前执行，所以用 dotenv 的 CLI 方式或预置环境变量
// 运行方式：set -a && source .env.local && set +a && npx tsx scripts/backfill-leopold.ts
import "dotenv/config";

import { prisma } from "../lib/prisma";
import { fetchLatestTweets } from "../lib/twitter";
import { analyzeTweetWithAi } from "../lib/ai";
import { sha256 } from "../lib/hash";
import type { AiAnalysis } from "../types";

// Leopold 发帖频率极低，放开到过去 12 个月
const START_DATE = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
const USERNAME = "leopoldasch";

// ─── Stock mentions ───────────────────────────────────────────────────────────

async function upsertMentions(tweetId: string, analysis: AiAnalysis) {
  await prisma.stockMention.deleteMany({ where: { tweetId } });

  const signals = [
    ...analysis.bullish_stocks.map((s) => ({ ...s, stance: "bullish" as const })),
    ...analysis.bearish_stocks.map((s) => ({ ...s, stance: "bearish" as const })),
  ];

  for (const signal of signals) {
    const stock = await prisma.stock.upsert({
      where: { ticker: signal.ticker },
      create: { ticker: signal.ticker, companyName: signal.company },
      update: { companyName: signal.company || undefined },
    });

    await prisma.stockMention.create({
      data: {
        tweetId,
        stockId: stock.id,
        stance: signal.stance,
        reason: signal.reason,
        confidence: analysis.confidence,
      },
    });
  }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  // 获取 leopold 频道和 WatchUser
  const channel = await prisma.channel.findUnique({ where: { slug: "leopold" } });
  if (!channel) {
    console.error("❌ leopold 频道不存在，请先运行 seed-channels.ts");
    process.exit(1);
  }

  const watchUser = await prisma.watchUser.findFirst({
    where: { username: USERNAME, channelId: channel.id },
  });
  if (!watchUser) {
    console.error(`❌ 未找到 WatchUser @${USERNAME}（绑定 leopold 频道），请先运行 setup-leopold.ts`);
    process.exit(1);
  }

  console.log(`\n🚀 开始回填 @${USERNAME} 过去 30 天的推文`);
  console.log(`   频道: ${channel.name} (${channel.id})`);
  console.log(`   起始时间: ${START_DATE.toISOString()}`);
  console.log(`   ⚠️  仅回填入库，不推送 WxPusher\n`);

  const tweets = await fetchLatestTweets({
    username: USERNAME,
    startTime: START_DATE,
    includeReplies: false,
    includeRetweets: false,
    maxResults: 100,
  });

  console.log(`📡 共爬取到 ${tweets.length} 条推文\n`);

  let created = 0, updated = 0, reanalyzed = 0, skipped = 0;

  for (const tweet of tweets) {
    const contentHash = sha256(`${tweet.authorUsername}:${tweet.content}`);

    const existing = await prisma.tweet.findFirst({
      where: { OR: [{ tweetId: tweet.tweetId }, { contentHash }] },
    });

    let savedId: string;
    let needsAnalysis: boolean;

    if (existing) {
      const contentChanged = existing.content !== tweet.content;
      const imageMissing =
        existing.imageUrls.length === 0 && (tweet.imageUrls ?? []).length > 0;
      const hashChanged = existing.contentHash !== contentHash;

      try {
        await prisma.tweet.update({
          where: { id: existing.id },
          data: {
            content: tweet.content,
            ...(hashChanged ? { contentHash } : {}),
            imageUrls: tweet.imageUrls ?? [],
            sourceUrl: tweet.sourceUrl ?? existing.sourceUrl,
            // 确保绑定到 leopold 频道
            channelId: channel.id,
            watchUserId: watchUser.id,
          },
        });
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "P2002") {
          await prisma.tweet.update({
            where: { id: existing.id },
            data: {
              content: tweet.content,
              imageUrls: tweet.imageUrls ?? [],
              sourceUrl: tweet.sourceUrl ?? existing.sourceUrl,
              channelId: channel.id,
              watchUserId: watchUser.id,
            },
          });
        } else throw e;
      }

      savedId = existing.id;
      needsAnalysis = contentChanged || imageMissing || !existing.aiAnalysis;

      if (contentChanged) {
        console.log(`  🔄 [${tweet.tweetId}] 正文变化，重新分析`);
      } else if (!existing.aiAnalysis) {
        console.log(`  🔄 [${tweet.tweetId}] 补充 AI 分析`);
      } else {
        console.log(`  ✓  [${tweet.tweetId}] 已存在，跳过`);
      }
      updated++;
    } else {
      const record = await prisma.tweet.create({
        data: {
          tweetId: tweet.tweetId,
          authorUsername: tweet.authorUsername,
          content: tweet.content,
          contentHash,
          sourceUrl: tweet.sourceUrl,
          imageUrls: tweet.imageUrls ?? [],
          tweetCreatedAt: tweet.tweetCreatedAt,
          watchUserId: watchUser.id,
          channelId: channel.id,  // ← 绑定 leopold 频道
        },
      });
      savedId = record.id;
      needsAnalysis = true;
      console.log(`  ➕ [${tweet.tweetId}] 新推文`);
      created++;
    }

    // ── AI 分析 ──────────────────────────────────────────────────────────────
    let analysis: AiAnalysis;
    if (needsAnalysis) {
      try {
        analysis = await analyzeTweetWithAi(tweet.content);
        await prisma.tweet.update({
          where: { id: savedId },
          data: {
            translatedContent: analysis.translated_content_cn,
            aiAnalysis: analysis,
          },
        });
        reanalyzed++;
      } catch (err) {
        console.error(`  ❌ [${tweet.tweetId}] AI 分析失败：`, err);
        skipped++;
        continue;
      }
    } else {
      const record = await prisma.tweet.findUnique({ where: { id: savedId } });
      analysis = record!.aiAnalysis as AiAnalysis;
    }

    // ── Stock mentions ────────────────────────────────────────────────────────
    await upsertMentions(savedId, analysis);

    const bulls = analysis.bullish_stocks.map((s) => s.ticker).join(", ") || "无";
    const bears = analysis.bearish_stocks.map((s) => s.ticker).join(", ") || "无";
    console.log(`     📈 ${bulls}  📉 ${bears}`);
  }

  console.log(`\n📊 回填完成：`);
  console.log(`   新建: ${created}  更新: ${updated}  重新分析: ${reanalyzed}  跳过: ${skipped}`);
  console.log(`\n✅ 去 dashboard 选 Leopold 频道查看结果！`);

  // 更新 WatchUser 的 lastTweetId（让 cron 从此继续增量爬取）
  // tweets 按时间升序，at(-1) 是最新的
  const newestTweet = tweets.at(-1);
  if (newestTweet) {
    await prisma.watchUser.update({
      where: { id: watchUser.id },
      data: { lastTweetId: newestTweet.tweetId },
    });
    console.log(`   lastTweetId 已更新: ${newestTweet.tweetId}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("回填失败：", err);
  prisma.$disconnect();
  process.exit(1);
});
