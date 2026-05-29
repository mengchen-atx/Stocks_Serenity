/**
 * 重新分析并推送指定推文（用完整 note_tweet 正文替换截断版本）
 * npx tsx --env-file=.env.local scripts/reanalyze-tweet.ts <tweetId>
 */

import { PrismaClient } from "@prisma/client";
import { analyzeTweetWithAi } from "@/lib/ai";
import { enrichStocks } from "@/lib/stocks";
import { sha256 } from "@/lib/hash";
import {
  buildWxPusherSummary,
  renderWxPusherHtml,
  sendWxPusherTopic
} from "@/lib/wxpusher";
import { getTopMentionedStocks } from "@/lib/insights";
import type { AiAnalysis } from "@/types";

const prisma = new PrismaClient();

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN!;

async function fetchFullTweet(tweetId: string) {
  const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=note_tweet,text,created_at,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
  });
  const data = await res.json() as {
    data?: {
      text: string;
      note_tweet?: { text: string };
      created_at?: string;
      attachments?: { media_keys?: string[] };
    };
    includes?: {
      media?: Array<{ media_key: string; type: string; url?: string; preview_image_url?: string }>;
    };
  };
  if (!data.data) throw new Error("推文不存在或 API 错误: " + JSON.stringify(data));
  return data;
}

async function main() {
  const tweetId = process.argv[2];
  if (!tweetId) {
    console.error("用法: npx tsx --env-file=.env.local scripts/reanalyze-tweet.ts <tweetId>");
    process.exit(1);
  }

  console.log(`\n🔍 查找推文 ${tweetId}...`);
  const existing = await prisma.tweet.findUnique({ where: { tweetId } });
  if (!existing) {
    console.error("数据库中找不到该推文");
    process.exit(1);
  }

  // ── 1. 从 Twitter API 拿完整正文 ────────────────────────────────────────────
  console.log("📡 从 Twitter API 获取完整正文...");
  const apiData = await fetchFullTweet(tweetId);
  const fullText = apiData.data!.note_tweet?.text ?? apiData.data!.text;

  const mediaMap = new Map<string, string>();
  for (const m of apiData.includes?.media ?? []) {
    const imgUrl = m.url ?? m.preview_image_url;
    if (imgUrl) mediaMap.set(m.media_key, imgUrl);
  }
  const imageUrls = (apiData.data!.attachments?.media_keys ?? [])
    .map(k => mediaMap.get(k))
    .filter((u): u is string => !!u);

  console.log(`\n原内容（${existing.content.length}字）:\n${existing.content}\n`);
  console.log(`完整内容（${fullText.length}字）:\n${fullText}\n`);

  if (fullText === existing.content) {
    console.log("✅ 内容一致，无需更新");
    await prisma.$disconnect();
    return;
  }

  // ── 2. 更新数据库：正文、hash、清除旧分析 ────────────────────────────────────
  const newHash = sha256(`${existing.authorUsername}:${fullText}`);
  console.log("💾 更新数据库正文...");
  await prisma.tweet.update({
    where: { tweetId },
    data: {
      content: fullText,
      contentHash: newHash,
      aiAnalysis: undefined,      // 清除旧分析，强制重新分析
      translatedContent: null,
      pushed: false               // 允许重新推送
    }
  });

  // 删除旧 stock mentions（分析结果将改变）
  await prisma.stockMention.deleteMany({ where: { tweetId: existing.id } });
  // 删除旧 push logs（允许重新推送）
  await prisma.pushLog.deleteMany({ where: { tweetId: existing.id } });

  // ── 3. AI 重新分析 ────────────────────────────────────────────────────────────
  console.log("🤖 AI 重新分析中...");
  const analysis: AiAnalysis = await analyzeTweetWithAi(fullText);

  console.log("\nAI 分析结果:");
  console.log("  利好:", analysis.bullish_stocks.map(s => s.ticker).join(", ") || "无");
  console.log("  利空:", analysis.bearish_stocks.map(s => s.ticker).join(", ") || "无");
  console.log("  置信度:", analysis.confidence);
  console.log("  摘要:", analysis.summary_cn.slice(0, 80));

  // ── 4. 保存分析结果 & 股票 mentions ─────────────────────────────────────────
  await prisma.tweet.update({
    where: { tweetId },
    data: {
      translatedContent: analysis.translated_content_cn,
      aiAnalysis: analysis as object
    }
  });

  const tickers = [
    ...analysis.bullish_stocks.map(s => s.ticker),
    ...analysis.bearish_stocks.map(s => s.ticker)
  ];
  const stocks = await enrichStocks(tickers);
  const stockMap = new Map(stocks.map(s => [s.ticker, s]));

  for (const sig of analysis.bullish_stocks) {
    const stock = await prisma.stock.upsert({
      where: { ticker: sig.ticker },
      create: { ticker: sig.ticker, companyName: sig.company },
      update: { companyName: sig.company || undefined }
    });
    await prisma.stockMention.upsert({
      where: { tweetId_stockId_stance: { tweetId: existing.id, stockId: stock.id, stance: "bullish" } },
      create: { tweetId: existing.id, stockId: stock.id, stance: "bullish", reason: sig.reason, confidence: analysis.confidence },
      update: { reason: sig.reason, confidence: analysis.confidence }
    });
  }
  for (const sig of analysis.bearish_stocks) {
    const stock = await prisma.stock.upsert({
      where: { ticker: sig.ticker },
      create: { ticker: sig.ticker, companyName: sig.company },
      update: { companyName: sig.company || undefined }
    });
    await prisma.stockMention.upsert({
      where: { tweetId_stockId_stance: { tweetId: existing.id, stockId: stock.id, stance: "bearish" } },
      create: { tweetId: existing.id, stockId: stock.id, stance: "bearish", reason: sig.reason, confidence: analysis.confidence },
      update: { reason: sig.reason, confidence: analysis.confidence }
    });
  }

  // ── 5. 推送 WxPusher ─────────────────────────────────────────────────────────
  console.log("\n📤 推送到 WxPusher...");
  const topMentions = await getTopMentionedStocks(30, 20).catch(() => undefined);
  const html = renderWxPusherHtml({
    sourceUrl: existing.sourceUrl,
    original: fullText,
    authorUsername: existing.authorUsername,
    tweetCreatedAt: existing.tweetCreatedAt,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    analysis,
    stocks,
    topMentions
  });
  const summary = buildWxPusherSummary(analysis);
  const pushResult = await sendWxPusherTopic(html, summary, existing.sourceUrl);

  if (pushResult.ok) {
    await prisma.tweet.update({ where: { tweetId }, data: { pushed: true } });
    console.log("✅ 推送成功！");
  } else {
    console.error("❌ 推送失败:", pushResult.body);
  }

  await prisma.$disconnect();
  console.log("\n🎉 完成！");
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
