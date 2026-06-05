/**
 * Citrini (@citrini) 频道初始化 + 历史推文回填
 *
 * - 创建 citrini 频道（无 wxpusherTopicId，仅 Dashboard 展示）
 * - 创建 WatchUser @citrini
 * - 授权两个管理员账号永久访问（不开启 push，仅 Dashboard）
 * - 回填过去 15 天推文（不触发任何 WxPusher 推送）
 *
 * 运行：set -a && source .env.local && set +a && npx tsx scripts/setup-citrini.ts
 */
import "dotenv/config";

import { prisma } from "../lib/prisma";
import { fetchLatestTweets } from "../lib/twitter";
import { analyzeTweetWithAi } from "../lib/ai";
import { sha256 } from "../lib/hash";
import type { AiAnalysis } from "../types";

const USERNAME     = "citrini";
const CHANNEL_SLUG = "citrini";
const CHANNEL_NAME = "Citrini";
const CHANNEL_DESC = "Citrini (@citrini) 科技投资深度分析";
const START_DATE   = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 过去 15 天

const ADMIN_UIDS = (process.env.WXPUSHER_OWNER_UID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────

async function upsertMentions(tweetId: string, analysis: AiAnalysis) {
  await prisma.stockMention.deleteMany({ where: { tweetId } });

  const signals = [
    ...analysis.bullish_stocks.map((s) => ({ ...s, stance: "bullish" as const })),
    ...analysis.bearish_stocks.map((s) => ({ ...s, stance: "bearish" as const })),
  ];

  for (const signal of signals) {
    const stock = await prisma.stock.upsert({
      where:  { ticker: signal.ticker },
      create: { ticker: signal.ticker, companyName: signal.company },
      update: { companyName: signal.company || undefined },
    });
    await prisma.stockMention.create({
      data: {
        tweetId,
        stockId: stock.id,
        stance:     signal.stance,
        reason:     signal.reason,
        confidence: analysis.confidence,
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 初始化 @${USERNAME} 频道\n`);

  // 1. 创建 / 获取频道（无 wxpusherTopicId → 永不推送 WxPusher）
  let channel = await prisma.channel.findUnique({ where: { slug: CHANNEL_SLUG } });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        slug:           CHANNEL_SLUG,
        name:           CHANNEL_NAME,
        description:    CHANNEL_DESC,
        wxpusherTopicId: null,
      },
    });
    console.log(`✅ 频道创建成功：${channel.name} (${channel.id})`);
  } else {
    console.log(`ℹ️  频道已存在：${channel.name} (${channel.id})`);
  }

  // 2. 创建 / 获取 WatchUser
  let watchUser = await prisma.watchUser.findFirst({ where: { username: USERNAME } });
  if (!watchUser) {
    watchUser = await prisma.watchUser.create({
      data: {
        username:        USERNAME,
        displayName:     CHANNEL_NAME,
        enabled:         true,
        includeReplies:  false,
        includeRetweets: false,
        channelId:       channel.id,
      },
    });
    console.log(`✅ WatchUser 创建成功：@${USERNAME}`);
  } else {
    if (watchUser.channelId !== channel.id) {
      await prisma.watchUser.update({
        where: { id: watchUser.id },
        data:  { channelId: channel.id },
      });
    }
    console.log(`ℹ️  WatchUser 已存在：@${USERNAME}`);
  }

  // 3. 授权管理员永久访问（pushEnabled = false，不开启推送）
  if (ADMIN_UIDS.length === 0) {
    console.warn("⚠️  WXPUSHER_OWNER_UID 未配置，跳过管理员授权");
  }
  for (const uid of ADMIN_UIDS) {
    await prisma.userChannelAccess.upsert({
      where:  { uid_channelId: { uid, channelId: channel.id } },
      create: { uid, channelId: channel.id, expiresAt: null, pushEnabled: false },
      update: { expiresAt: null },
    });
  }
  console.log(`✅ 管理员永久授权完毕（仅 Dashboard，无推送）：${ADMIN_UIDS.join(", ")}`);

  // 4. 回填过去 15 天推文
  console.log(`\n🚀 开始回填 @${USERNAME} 过去 15 天的推文`);
  console.log(`   起始时间: ${START_DATE.toISOString()}`);
  console.log(`   ⚠️  仅回填入库，不推送 WxPusher\n`);

  const tweets = await fetchLatestTweets({
    username:        USERNAME,
    startTime:       START_DATE,
    includeReplies:  false,
    includeRetweets: false,
    maxResults:      100,
  });

  console.log(`📡 共爬取到 ${tweets.length} 条推文\n`);

  if (tweets.length === 0) {
    console.log("   (过去 15 天无原创推文)");
    await prisma.$disconnect();
    return;
  }

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
      const imageMissing   = existing.imageUrls.length === 0 && (tweet.imageUrls ?? []).length > 0;
      const hashChanged    = existing.contentHash !== contentHash;
      try {
        await prisma.tweet.update({
          where: { id: existing.id },
          data:  {
            content:     tweet.content,
            ...(hashChanged ? { contentHash } : {}),
            imageUrls:   tweet.imageUrls ?? [],
            sourceUrl:   tweet.sourceUrl ?? existing.sourceUrl,
            channelId:   channel.id,
            watchUserId: watchUser.id,
          },
        });
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "P2002") {
          await prisma.tweet.update({
            where: { id: existing.id },
            data:  { content: tweet.content, imageUrls: tweet.imageUrls ?? [], channelId: channel.id, watchUserId: watchUser.id },
          });
        } else throw e;
      }
      savedId       = existing.id;
      needsAnalysis = contentChanged || imageMissing || !existing.aiAnalysis;
      console.log(
        contentChanged    ? `  🔄 [${tweet.tweetId}] 内容变化，重新分析`
        : !existing.aiAnalysis ? `  🔄 [${tweet.tweetId}] 补充分析`
        : `  ✓  [${tweet.tweetId}] 已存在`
      );
      updated++;
    } else {
      const record = await prisma.tweet.create({
        data: {
          tweetId:       tweet.tweetId,
          authorUsername: tweet.authorUsername,
          content:        tweet.content,
          contentHash,
          sourceUrl:      tweet.sourceUrl,
          imageUrls:      tweet.imageUrls ?? [],
          tweetCreatedAt: tweet.tweetCreatedAt,
          watchUserId:    watchUser.id,
          channelId:      channel.id,
        },
      });
      savedId       = record.id;
      needsAnalysis = true;
      console.log(`  ➕ [${tweet.tweetId}] 新推文`);
      created++;
    }

    if (needsAnalysis) {
      try {
        const analysis = await analyzeTweetWithAi(tweet.content);
        await prisma.tweet.update({
          where: { id: savedId },
          data:  { translatedContent: analysis.translated_content_cn, aiAnalysis: analysis },
        });
        await upsertMentions(savedId, analysis);
        const bulls = analysis.bullish_stocks.map((s) => s.ticker).join(", ") || "无";
        const bears = analysis.bearish_stocks.map((s) => s.ticker).join(", ") || "无";
        console.log(`     📈 ${bulls}  📉 ${bears}`);
        reanalyzed++;
      } catch (err) {
        console.error(`  ❌ [${tweet.tweetId}] AI 分析失败：`, err);
        skipped++;
      }
    } else {
      const record = await prisma.tweet.findUnique({ where: { id: savedId } });
      if (record?.aiAnalysis) await upsertMentions(savedId, record.aiAnalysis as AiAnalysis);
    }
  }

  console.log(`\n📊 回填完成：新建 ${created}  更新 ${updated}  分析 ${reanalyzed}  跳过 ${skipped}`);

  // 记录最新 tweetId（tweets 按升序返回，at(-1) 是最新的）
  const newestTweet = tweets.at(-1);
  if (newestTweet) {
    await prisma.watchUser.update({
      where: { id: watchUser.id },
      data:  { lastTweetId: newestTweet.tweetId },
    });
    console.log(`   lastTweetId 已更新: ${newestTweet.tweetId}`);
  }

  console.log(`\n✅ 完成！去 Dashboard 选「Citrini」频道查看结果。`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("失败：", err);
  prisma.$disconnect();
  process.exit(1);
});
