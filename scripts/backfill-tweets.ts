/**
 * 回填脚本：重新爬取 5月1日至今的所有推文
 *
 * 用途：
 * - 补全之前爬不完整的推文正文和图片
 * - 重新分析 AI / 股票 mentions（修复遗漏的看空信号等）
 * - 不发送 WxPusher 推送
 *
 * 运行：
 *   npx tsx scripts/backfill-tweets.ts
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchLatestTweets } from "../lib/twitter";
import { analyzeTweetWithAi } from "../lib/ai";
import { sha256 } from "../lib/hash";
import type { AiAnalysis } from "../types";

const START_DATE = new Date("2026-05-01T00:00:00Z");

// ─── 补全 stockMentions ───────────────────────────────────────────────────────

async function upsertMentions(tweetId: string, analysis: AiAnalysis) {
  // 先清掉旧的 mentions，避免之前错误分析的残留
  await prisma.stockMention.deleteMany({ where: { tweetId } });

  const allSignals = [
    ...analysis.bullish_stocks.map((s) => ({ ...s, stance: "bullish" as const })),
    ...analysis.bearish_stocks.map((s) => ({ ...s, stance: "bearish" as const }))
  ];

  for (const signal of allSignals) {
    const stock = await prisma.stock.upsert({
      where: { ticker: signal.ticker },
      create: { ticker: signal.ticker, companyName: signal.company },
      update: { companyName: signal.company || undefined }
    });

    await prisma.stockMention.create({
      data: {
        tweetId,
        stockId: stock.id,
        stance: signal.stance,
        reason: signal.reason,
        confidence: analysis.confidence
      }
    });
  }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  const users = await prisma.watchUser.findMany({ where: { enabled: true } });

  if (users.length === 0) {
    console.error("❌ 没有找到启用的 WatchUser，请检查数据库");
    process.exit(1);
  }

  for (const user of users) {
    console.log(`\n📡 开始爬取 @${user.username} 从 ${START_DATE.toISOString()} 起的推文...`);

    const tweets = await fetchLatestTweets({
      username: user.username,
      startTime: START_DATE,
      includeReplies: false,
      includeRetweets: false,
      maxResults: 100
    });

    console.log(`✅ 共爬取到 ${tweets.length} 条推文（已过滤 reply/retweet）\n`);

    let created = 0, updated = 0, reanalyzed = 0, skipped = 0;

    for (const tweet of tweets) {
      const contentHash = sha256(`${tweet.authorUsername}:${tweet.content}`);

      // 先按 tweetId 查找，再按 contentHash 兜底
      const existing = await prisma.tweet.findFirst({
        where: { OR: [{ tweetId: tweet.tweetId }, { contentHash }] }
      });

      let savedId: string;
      let needsAnalysis: boolean;

      if (existing) {
        const contentChanged = existing.content !== tweet.content;
        const imageMissing = existing.imageUrls.length === 0 && (tweet.imageUrls ?? []).length > 0;

        // 更新正文、图片（contentHash 只在真正变化时才更新，避免冲突）
        const hashChanged = existing.contentHash !== contentHash;
        try {
          await prisma.tweet.update({
            where: { id: existing.id },
            data: {
              content: tweet.content,
              ...(hashChanged ? { contentHash } : {}),
              imageUrls: tweet.imageUrls ?? [],
              sourceUrl: tweet.sourceUrl ?? existing.sourceUrl
            }
          });
        } catch (e: unknown) {
          // P2002: contentHash 与另一条推文冲突，跳过 hash 更新，只更新图片和内容
          if ((e as { code?: string }).code === "P2002") {
            await prisma.tweet.update({
              where: { id: existing.id },
              data: {
                content: tweet.content,
                imageUrls: tweet.imageUrls ?? [],
                sourceUrl: tweet.sourceUrl ?? existing.sourceUrl
              }
            });
          } else throw e;
        }

        savedId = existing.id;
        // 内容变了或之前没有 AI 分析 → 重新分析
        needsAnalysis = contentChanged || imageMissing || !existing.aiAnalysis;

        if (contentChanged) {
          console.log(`  🔄 [${tweet.tweetId}] 正文有变化，重新分析`);
        } else if (!existing.aiAnalysis) {
          console.log(`  🔄 [${tweet.tweetId}] 缺少 AI 分析，补充分析`);
        } else {
          console.log(`  ✓  [${tweet.tweetId}] 内容一致，跳过重新分析`);
        }
        updated++;
      } else {
        const created_record = await prisma.tweet.create({
          data: {
            tweetId: tweet.tweetId,
            authorUsername: tweet.authorUsername,
            content: tweet.content,
            contentHash,
            sourceUrl: tweet.sourceUrl,
            imageUrls: tweet.imageUrls ?? [],
            tweetCreatedAt: tweet.tweetCreatedAt,
            watchUserId: user.id
          }
        });
        savedId = created_record.id;
        needsAnalysis = true;
        console.log(`  ➕ [${tweet.tweetId}] 新推文，创建并分析`);
        created++;
      }

      // ── AI 分析 ────────────────────────────────────────────────────────────
      let analysis: AiAnalysis;
      if (needsAnalysis) {
        try {
          analysis = await analyzeTweetWithAi(tweet.content);
          await prisma.tweet.update({
            where: { id: savedId },
            data: {
              translatedContent: analysis.translated_content_cn,
              aiAnalysis: analysis
            }
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

      // ── 重建 stock mentions（始终重建，保证准确）──────────────────────────
      await upsertMentions(savedId, analysis);

      const bulls = analysis.bullish_stocks.map((s) => s.ticker).join(", ") || "无";
      const bears = analysis.bearish_stocks.map((s) => s.ticker).join(", ") || "无";
      console.log(`     📈 利好: ${bulls}  📉 利空: ${bears}`);
    }

    console.log(`\n📊 @${user.username} 处理完成：`);
    console.log(`   新建: ${created}  更新: ${updated}  重新分析: ${reanalyzed}  跳过: ${skipped}`);
  }

  console.log("\n🎉 全部回填完成！请刷新 dashboard 查看结果。");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("回填失败：", err);
  prisma.$disconnect();
  process.exit(1);
});
