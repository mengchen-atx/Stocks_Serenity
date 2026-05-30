/**
 * 历史消息补发模块
 *
 * 当新用户订阅 WxPusher 后，单独给该用户发送所有历史已分析推文。
 * 调用场景：/api/webhooks/wxpusher 收到订阅回调时，在后台运行。
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getTopMentionedStocks } from "@/lib/insights";
import {
  renderWxPusherHtml,
  buildWxPusherSummary,
  sendWxPusherToUids
} from "@/lib/wxpusher";
import type { AiAnalysis, StockProfile } from "@/types";

const SEND_DELAY_MS = 800; // 每条消息之间间隔 800ms，避免触发频率限制

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 将数据库 Stock 行转换为 StockProfile（renderWxPusherHtml 所需格式）
 */
function toStockProfile(stock: {
  ticker: string;
  companyName: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  marketCap: bigint | null;
  marketCapDisplay: string | null;
  companyDescription: string | null;
  industry: string | null;
  themes: string[];
}): StockProfile {
  return {
    ticker: stock.ticker,
    company: stock.companyName,
    exchange: stock.exchange,
    currency: stock.currency,
    price: stock.price,
    market_cap: stock.marketCapDisplay,
    market_cap_raw: stock.marketCap !== null ? Number(stock.marketCap) : null,
    company_description: stock.companyDescription,
    industry: stock.industry,
    theme: stock.themes
  };
}

/**
 * 发送所有历史推文给指定 UID
 *
 * 调用前应先在 HistorySendJob 中创建好记录（status: "pending"）。
 * 函数内部会更新 status / sent / total / error 字段。
 */
export async function sendHistoryToSubscriber(uid: string): Promise<void> {
  const job = await prisma.historySendJob.findUnique({ where: { uid } });
  if (!job) {
    logger.warn({ uid }, "sendHistoryToSubscriber: job not found");
    return;
  }
  if (job.status === "done") {
    logger.info({ uid }, "sendHistoryToSubscriber: already done, skip");
    return;
  }

  logger.info({ uid }, "sendHistoryToSubscriber: start");

  try {
    // 拉取所有已推送（=已分析）推文，按发布时间升序（从最老的开始发）
    // pushed: true 代表已完成分析+推送，aiAnalysis 必然非空
    const tweets = await prisma.tweet.findMany({
      where: { pushed: true },
      orderBy: { tweetCreatedAt: "asc" },
      include: {
        stockMentions: {
          include: { stock: true }
        }
      }
    });

    const total = tweets.length;
    await prisma.historySendJob.update({
      where: { uid },
      data: { total, status: "running" }
    });

    logger.info({ uid, total }, "sendHistoryToSubscriber: fetched tweets");

    // 近 30 天热榜（全程复用同一份，避免重复查询）
    const topMentions = await getTopMentionedStocks(30, 20).catch(() => undefined);

    // ── 欢迎消息（第一条）────────────────────────────────────────────────────
    const welcomeHtml = `
<div style="font-family:sans-serif;max-width:520px;padding:20px;background:#f8fafc;border-radius:12px;">
  <h2 style="color:#0f172a;margin:0 0 12px;">📊 欢迎加入 Serenity Intelligence</h2>
  <p style="color:#334155;line-height:1.6;margin:0 0 12px;">
    你已成功订阅！我们实时监控科技投资 KOL 的推文，用 AI 深度分析投资逻辑，第一时间推送到你的微信。
  </p>
  <div style="background:#e0f2fe;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
    <p style="color:#0369a1;margin:0;font-size:14px;">
      📬 接下来将为你补发 <strong>${total} 条</strong>历史分析消息，请稍候…
    </p>
  </div>
  <p style="color:#64748b;font-size:13px;margin:0;">
    · 每条消息包含原文翻译、AI 核心解读、利好/利空股票<br/>
    · Dashboard 登录：<a href="https://stocks-plum.vercel.app/dashboard" style="color:#0ea5e9;">stocks-plum.vercel.app/dashboard</a>
  </p>
</div>`.trim();

    await sendWxPusherToUids([uid], welcomeHtml, `欢迎加入 Serenity！即将补发 ${total} 条历史分析`, null);
    await sleep(SEND_DELAY_MS);

    let sent = 0;
    for (const tweet of tweets) {
      const analysis = tweet.aiAnalysis as AiAnalysis;

      // 每个 ticker 去重：同一 ticker 可能出现在多个 stockMentions 行（利好+利空各一行）
      const seenTickers = new Set<string>();
      const stocks: StockProfile[] = [];
      for (const m of tweet.stockMentions) {
        if (!seenTickers.has(m.stock.ticker)) {
          seenTickers.add(m.stock.ticker);
          stocks.push(toStockProfile(m.stock));
        }
      }

      const html = renderWxPusherHtml({
        sourceUrl: tweet.sourceUrl,
        original: tweet.content,
        authorUsername: tweet.authorUsername,
        tweetCreatedAt: tweet.tweetCreatedAt,
        analysis,
        stocks,
        topMentions
      });
      const summary = buildWxPusherSummary(analysis);

      const result = await sendWxPusherToUids([uid], html, summary, tweet.sourceUrl);

      if (!result.ok) {
        logger.warn(
          { uid, tweetId: tweet.id, status: result.status, body: result.body },
          "sendHistoryToSubscriber: send failed for one tweet"
        );
        // 如果是"未订阅应用"错误（WxPusher code 1001），无需继续重试
        if (result.body.includes("1001") || result.body.includes("未订阅应用")) {
          await prisma.historySendJob.update({
            where: { uid },
            data: {
              status: "failed",
              error: `UID ${uid} 未订阅应用，需要用户扫描应用二维码（非话题二维码）才能接收直推消息`
            }
          });
          logger.warn({ uid }, "sendHistoryToSubscriber: UID not subscribed to app, abort");
          return;
        }
        // 其他错误：跳过本条，继续下一条
      }

      sent++;
      await prisma.historySendJob.update({
        where: { uid },
        data: { sent }
      });

      // 非最后一条时等待，避免触发 WxPusher 频率限制
      if (sent < total) {
        await sleep(SEND_DELAY_MS);
      }
    }

    await prisma.historySendJob.update({
      where: { uid },
      data: { status: "done", doneAt: new Date() }
    });

    logger.info({ uid, sent, total }, "sendHistoryToSubscriber: complete");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ uid, error: errMsg }, "sendHistoryToSubscriber: unexpected error");

    await prisma.historySendJob.update({
      where: { uid },
      data: { status: "failed", error: errMsg }
    }).catch(() => { /* 更新失败时忽略，避免掩盖原始错误 */ });
  }
}
