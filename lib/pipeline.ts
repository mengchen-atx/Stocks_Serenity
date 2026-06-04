import { PushChannel, PushStatus } from "@prisma/client";
import { analyzeTweetWithAi } from "@/lib/ai";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enrichStocks } from "@/lib/stocks";
import { fetchLatestTweets } from "@/lib/twitter";
import {
  renderWechatMarkdown,
  sendServerChan,
  sendWechatMarkdown,
  sendWechatTemplate
} from "@/lib/wechat";
import { renderTelegramMessage, sendTelegramMessage } from "@/lib/telegram";
import { sendEmailAlert } from "@/lib/email";
import {
  buildWxPusherSummary,
  renderWxPusherHtml,
  sendWxPusherTopic,
  fetchTopicSubscriberUids,
  fetchTopicSubscribersWithExpiry
} from "@/lib/wxpusher";
import { isAdminUid } from "@/lib/admin";
import { getTopMentionedStocks } from "@/lib/insights";
import type { TopMention } from "@/lib/insights";
import type { AiAnalysis, TweetInput, StockProfile } from "@/types";
import { sendHistoryToSubscriber } from "@/lib/history-sender";

export type PipelineResult = {
  fetched: number;
  analyzed: number;
  pushed: number;
  skipped: number;
};

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runSerenityPipeline(): Promise<PipelineResult> {
  const cronRun = await prisma.cronRun.create({ data: { status: "RUNNING" } });
  const result: PipelineResult = { fetched: 0, analyzed: 0, pushed: 0, skipped: 0 };

  try {
    const users = await getEnabledWatchUsers();

    for (const user of users) {
      const tweets = await fetchLatestTweets({
        username: user.username,
        sinceId: user.lastTweetId,
        includeReplies: user.includeReplies,
        includeRetweets: user.includeRetweets,
        maxResults: 20
      });

      result.fetched += tweets.length;

      // 获取该 WatchUser 对应频道的 wxpusherTopicId
      const channelTopicId = user.channel?.wxpusherTopicId ?? null;

      for (const tweet of tweets) {
        const handled = await handleTweet(tweet, user.id, user.channelId ?? undefined, channelTopicId);
        result.analyzed += handled.analyzed ? 1 : 0;
        result.pushed += handled.pushed ? 1 : 0;
        result.skipped += handled.skipped ? 1 : 0;
      }

      const newest = tweets.at(-1);
      if (newest) {
        await prisma.watchUser.update({
          where: { id: user.id },
          data: { lastTweetId: newest.tweetId }
        });
      }
    }

    // ── 安全网1：同步 WxPusher 订阅者 → 补充因 webhook 丢失未授权的用户 ──────
    await syncWxPusherSubscribers();

    // ── 安全网2：处理卡住的历史发送任务（webhook 超时未完成的） ────────────────
    await retryPendingHistoryJobs();

    await prisma.cronRun.update({
      where: { id: cronRun.id },
      data: { ...result, status: "SUCCESS", finishedAt: new Date() }
    });

    return result;
  } catch (error) {
    logger.error({ error }, "pipeline failed");
    await prisma.cronRun.update({
      where: { id: cronRun.id },
      data: {
        ...result,
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date()
      }
    });
    throw error;
  }
}

// ─── Single tweet handler ─────────────────────────────────────────────────────

export async function handleTweet(
  tweet: TweetInput,
  watchUserId?: string,
  channelId?: string,
  channelTopicId?: string | null
) {
  const contentHash = sha256(`${tweet.authorUsername}:${tweet.content}`);
  const existing = await prisma.tweet.findFirst({
    where: { OR: [{ tweetId: tweet.tweetId }, { contentHash }] }
  });

  if (existing?.pushed) {
    return { analyzed: false, pushed: false, skipped: true };
  }

  const saved =
    existing ??
    (await prisma.tweet.create({
      data: {
        tweetId: tweet.tweetId,
        authorUsername: tweet.authorUsername,
        content: tweet.content,
        contentHash,
        sourceUrl: tweet.sourceUrl,
        imageUrls: tweet.imageUrls ?? [],
        tweetCreatedAt: tweet.tweetCreatedAt,
        watchUserId,
        channelId: channelId ?? null,
      }
    }));

  const analysis: AiAnalysis = saved.aiAnalysis
    ? (saved.aiAnalysis as AiAnalysis)
    : await analyzeTweetWithAi(tweet.content);

  const tickers = [
    ...analysis.bullish_stocks.map((s) => s.ticker),
    ...analysis.bearish_stocks.map((s) => s.ticker)
  ];
  const stocks = await enrichStocks(tickers);

  await prisma.tweet.update({
    where: { id: saved.id },
    data: {
      translatedContent: analysis.translated_content_cn,
      aiAnalysis: analysis
    }
  });

  await upsertMentions(saved.id, analysis);

  const channels = enabledPushChannels();
  if (channels.length === 0) {
    await logSkipped(saved.id, PushChannel.WECHAT_WORK_BOT, "no-channel", "No push channel configured");
    return { analyzed: !saved.aiAnalysis, pushed: false, skipped: true };
  }

  // 查询近30天热榜（仅 WxPusher 用到，按当前频道过滤）
  const topMentions = channels.includes(PushChannel.WXPUSHER)
    ? await getTopMentionedStocks(30, 10, channelId).catch(() => undefined)
    : undefined;

  let sentOk = false;

  for (const channel of channels) {
    const { content, payloadHash } = buildChannelPayload(channel, {
      tweet,
      analysis,
      stocks,
      topMentions
    });

    const alreadySent = await prisma.pushLog.findUnique({
      where: { tweetId_channel_payloadHash: { tweetId: saved.id, channel, payloadHash } }
    });
    if (alreadySent?.status === PushStatus.SENT) continue;

    let sent: { ok: boolean; status: number; body: string };
    try {
      sent = await dispatchChannel(channel, content, tweet, analysis, stocks, { channelTopicId });
    } catch (err) {
      logger.error({ err, channel }, "push dispatch failed");
      sent = { ok: false, status: 500, body: String(err) };
    }

    sentOk ||= sent.ok;

    await prisma.pushLog.upsert({
      where: { tweetId_channel_payloadHash: { tweetId: saved.id, channel, payloadHash } },
      create: {
        tweetId: saved.id,
        channel,
        status: sent.ok ? PushStatus.SENT : PushStatus.FAILED,
        responseStatus: sent.status,
        responseBody: sent.body.slice(0, 1000),
        payloadHash
      },
      update: {
        status: sent.ok ? PushStatus.SENT : PushStatus.FAILED,
        responseStatus: sent.status,
        responseBody: sent.body.slice(0, 1000)
      }
    });
  }

  if (sentOk) {
    await prisma.tweet.update({ where: { id: saved.id }, data: { pushed: true } });

  }

  return { analyzed: !saved.aiAnalysis, pushed: sentOk, skipped: false };
}

// ─── Channel dispatch ─────────────────────────────────────────────────────────

function buildChannelPayload(
  channel: PushChannel,
  params: { tweet: TweetInput; analysis: AiAnalysis; stocks: StockProfile[]; topMentions?: TopMention[] }
): { content: string; payloadHash: string } {
  let content: string;

  switch (channel) {
    case PushChannel.TELEGRAM: {
      content = renderTelegramMessage({
        sourceUrl: params.tweet.sourceUrl,
        original: params.tweet.content,
        authorUsername: params.tweet.authorUsername,
        analysis: params.analysis,
        stocks: params.stocks
      });
      break;
    }
    case PushChannel.WXPUSHER: {
      content = renderWxPusherHtml({
        sourceUrl: params.tweet.sourceUrl,
        original: params.tweet.content,
        authorUsername: params.tweet.authorUsername,
        tweetCreatedAt: params.tweet.tweetCreatedAt,
        imageUrls: params.tweet.imageUrls,
        analysis: params.analysis,
        stocks: params.stocks,
        topMentions: params.topMentions
      });
      break;
    }
    case PushChannel.EMAIL: {
      // For email channel, we use a JSON placeholder as payload hash base
      content = JSON.stringify({
        authorUsername: params.tweet.authorUsername,
        summary_cn: params.analysis.summary_cn,
        tickers: [
          ...params.analysis.bullish_stocks.map((s) => s.ticker),
          ...params.analysis.bearish_stocks.map((s) => s.ticker)
        ]
      });
      break;
    }
    default: {
      content = renderWechatMarkdown({
        sourceUrl: params.tweet.sourceUrl,
        original: params.tweet.content,
        authorUsername: params.tweet.authorUsername,
        analysis: params.analysis,
        stocks: params.stocks
      });
    }
  }

  return { content, payloadHash: sha256(content) };
}

async function dispatchChannel(
  channel: PushChannel,
  content: string,
  tweet: TweetInput,
  analysis: AiAnalysis,
  stocks: StockProfile[],
  extra?: { channelTopicId?: string | null }
): Promise<{ ok: boolean; status: number; body: string }> {
  switch (channel) {
    case PushChannel.WECHAT_WORK_BOT:
      return sendWechatMarkdown(content);

    case PushChannel.SERVER_CHAN:
      return sendServerChan(content);

    case PushChannel.WECHAT_TEMPLATE:
      return sendWechatTemplate(content);

    case PushChannel.TELEGRAM:
      return sendTelegramMessage(content);

    case PushChannel.WXPUSHER: {
      // extra.channelTopicId === null  → 频道存在但未配置主题，跳过推送
      // extra.channelTopicId === undefined → 无频道上下文，用全局 env.WXPUSHER_TOPIC_ID
      // extra.channelTopicId === "xxx" → 推送到指定主题
      if (extra !== undefined && extra.channelTopicId === null) {
        return { ok: true, status: 200, body: "no_topic_for_channel_skipped" };
      }
      return sendWxPusherTopic(
        content,
        buildWxPusherSummary(analysis),
        tweet.sourceUrl,
        extra?.channelTopicId ?? undefined
      );
    }

    case PushChannel.EMAIL: {
      // Push to all Pro+ subscribers who have email notifications enabled
      const subscribers = await prisma.user.findMany({
        where: {
          notifyEmail: true,
          subscriptionTier: { in: ["BASIC", "PRO", "PREMIUM"] }
        },
        select: { email: true }
      });

      const emails = subscribers.map((u) => u.email);
      if (emails.length === 0) {
        // Fall back to override if set
        if (env.EMAIL_TO_OVERRIDE) {
          emails.push(env.EMAIL_TO_OVERRIDE);
        } else {
          return { ok: true, status: 200, body: "no_subscribers" };
        }
      }

      return sendEmailAlert({
        to: emails,
        sourceUrl: tweet.sourceUrl,
        original: tweet.content,
        authorUsername: tweet.authorUsername,
        analysis,
        stocks
      });
    }

    default:
      return { ok: false, status: 400, body: `unknown channel: ${channel}` };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getEnabledWatchUsers() {
  const users = await prisma.watchUser.findMany({
    where: { enabled: true },
    include: { channel: { select: { id: true, wxpusherTopicId: true } } }
  });
  if (users.length > 0) return users;

  // 兜底：如果数据库没有 WatchUser，用环境变量创建一个（归入 serenity 频道）
  const serenity = await prisma.channel.findUnique({ where: { slug: "serenity" } });
  const created = await prisma.watchUser.create({
    data: {
      username: env.TWITTER_USERNAME,
      includeReplies: env.TWITTER_INCLUDE_REPLIES,
      includeRetweets: env.TWITTER_INCLUDE_RETWEETS,
      channelId: serenity?.id ?? null,
    },
    include: { channel: { select: { id: true, wxpusherTopicId: true } } }
  });
  return [created];
}

async function upsertMentions(tweetId: string, analysis: AiAnalysis) {
  const allSignals = [
    ...analysis.bullish_stocks.map((s) => ({ ...s, stance: "bullish" })),
    ...analysis.bearish_stocks.map((s) => ({ ...s, stance: "bearish" }))
  ];

  for (const signal of allSignals) {
    const stock = await prisma.stock.upsert({
      where: { ticker: signal.ticker },
      create: { ticker: signal.ticker, companyName: signal.company },
      // Never overwrite an existing company name with an AI guess.
      // enrichStocks (Finnhub) is the authoritative source for updates.
      update: {}
    });

    await prisma.stockMention.upsert({
      where: {
        tweetId_stockId_stance: { tweetId, stockId: stock.id, stance: signal.stance }
      },
      create: {
        tweetId,
        stockId: stock.id,
        stance: signal.stance,
        reason: signal.reason,
        confidence: analysis.confidence
      },
      update: { reason: signal.reason, confidence: analysis.confidence }
    });
  }
}

function enabledPushChannels(): PushChannel[] {
  const channels: PushChannel[] = [];
  if (env.WECHAT_WEBHOOK) channels.push(PushChannel.WECHAT_WORK_BOT);
  if (env.SERVER_CHAN_SENDKEY) channels.push(PushChannel.SERVER_CHAN);
  if (env.WECHAT_TEMPLATE_ENDPOINT) channels.push(PushChannel.WECHAT_TEMPLATE);
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID) channels.push(PushChannel.TELEGRAM);
  if (env.RESEND_API_KEY) channels.push(PushChannel.EMAIL);
  if (env.WXPUSHER_APP_TOKEN && env.WXPUSHER_TOPIC_ID) channels.push(PushChannel.WXPUSHER);
  return channels;
}

async function logSkipped(
  tweetId: string,
  channel: PushChannel,
  payloadHash: string,
  error: string
) {
  await prisma.pushLog.upsert({
    where: { tweetId_channel_payloadHash: { tweetId, channel, payloadHash } },
    create: { tweetId, channel, status: PushStatus.SKIPPED, payloadHash, error },
    update: {}
  });
}

/**
 * 安全网：每次 cron 运行时，从 WxPusher API 拉取各频道话题的订阅者列表，
 * 自动为尚未授权的订阅者补充 UserChannelAccess 记录。
 * 防止 webhook 回调丢失导致用户订阅后进不了 dashboard。
 */
async function syncWxPusherSubscribers(): Promise<void> {
  try {
    const channels = await prisma.channel.findMany({
      where: { wxpusherTopicId: { not: null } },
    });

    for (const channel of channels) {
      if (!channel.wxpusherTopicId) continue;

      // 拉取订阅者列表，包含 payEndTime
      const subscribers = await fetchTopicSubscribersWithExpiry(channel.wxpusherTopicId);

      const now = Date.now();
      // 有效付费订阅的 UID 集合
      const paidUidSet = new Set(
        subscribers
          .filter((s) => !isAdminUid(s.uid) && s.payEndTime && s.payEndTime > now)
          .map((s) => s.uid)
      );

      // 当前 DB 里所有非管理员的授权记录（expiresAt 未过期）
      const existing = await prisma.userChannelAccess.findMany({
        where: {
          channelId: channel.id,
          expiresAt: { not: null },           // null = 永久（管理员），不动
        },
        select: { uid: true, expiresAt: true },
      });

      let grantedCount = 0;
      let renewedCount = 0;
      let revokedCount = 0;

      // ── 撤销：DB 有记录但 WxPusher 里已退款/过期 ─────────────────────────
      for (const record of existing) {
        if (isAdminUid(record.uid)) continue;
        if (record.uid.startsWith("PWD_")) continue;   // 账号密码用户不走 WxPusher 验证
        if (!paidUidSet.has(record.uid)) {
          // 不在有效付费列表里 → 立即撤权
          await prisma.userChannelAccess.deleteMany({
            where: { uid: record.uid, channelId: channel.id },
          });
          revokedCount++;
          logger.info({ uid: record.uid, channel: channel.slug }, "syncWxPusherSubscribers: revoked (refund/expired)");
        }
      }

      const existingMap = new Map(existing.map((r) => [r.uid, r.expiresAt]));

      // ── 新增/续费：WxPusher 有效付费但 DB 不存在或 expiresAt 变了 ──────────
      for (const sub of subscribers) {
        if (isAdminUid(sub.uid)) continue;
        if (sub.uid.startsWith("PWD_")) continue;   // 账号密码用户不走 WxPusher 验证
        if (!sub.payEndTime || sub.payEndTime <= now) continue;

        const expiresAt = new Date(sub.payEndTime);

        if (!existingMap.has(sub.uid)) {
          await prisma.userChannelAccess.create({
            data: { uid: sub.uid, channelId: channel.id, expiresAt },
          });
          grantedCount++;
        } else {
          const currentExpiry = existingMap.get(sub.uid);
          if (expiresAt.getTime() !== currentExpiry?.getTime()) {
            await prisma.userChannelAccess.updateMany({
              where: { uid: sub.uid, channelId: channel.id },
              data: { expiresAt },
            });
            renewedCount++;
          }
        }
      }

      if (grantedCount > 0 || renewedCount > 0 || revokedCount > 0) {
        logger.info(
          { channel: channel.slug, grantedCount, renewedCount, revokedCount },
          "syncWxPusherSubscribers: access updated"
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "syncWxPusherSubscribers failed");
  }
}

/**
 * 安全网：每次 cron 运行时，检查是否有 pending/running 的历史发送任务。
 * 正常情况下 webhook 的 waitUntil 会处理完；这里是兜底，防止 Vercel 函数超时中断后任务卡死。
 * 每次最多处理 1 个任务（避免占用 cron 时间过长）。
 */
async function retryPendingHistoryJobs(): Promise<void> {
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 分钟前还没完成的

  const job = await prisma.historySendJob.findFirst({
    where: {
      status: { in: ["pending", "running"] },
      createdAt: { lt: staleThreshold }
    },
    orderBy: { createdAt: "asc" }
  });

  if (!job) return;

  logger.info({ uid: job.uid, status: job.status }, "pipeline: retrying stale history send job");
  await sendHistoryToSubscriber(job.uid);
}
