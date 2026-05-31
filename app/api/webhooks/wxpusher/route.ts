/**
 * WxPusher 订阅回调 Webhook
 *
 * 当用户扫码订阅/取关时，WxPusher 会向此地址发送 POST 请求。
 * 只有「付费主题订阅」（payEndTime > now）才授权 dashboard 访问权限和欢迎消息。
 * 免费的「应用关注」不授权。
 *
 * 在 WxPusher 管理后台配置回调地址：
 *   应用 → 编辑 → 关注/取关回调URL → 填入：
 *   https://www.alphaline.fit/api/webhooks/wxpusher
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { grantChannelAccess, revokeChannelAccess } from "@/lib/channels";
import { sendWxPusherToUids, fetchTopicSubscribersWithExpiry } from "@/lib/wxpusher";
import { isAdminUid } from "@/lib/admin";

// ─── 欢迎消息（仅付费主题订阅者） ────────────────────────────────────────────

const WELCOME_HTML = `
<div style="font-family:sans-serif;max-width:480px;padding:4px 0">
  <h3 style="margin:0 0 12px;font-size:17px">📊 欢迎加入 Serenity 一手信息（AI 深度解析）</h3>
  <p style="margin:0 0 12px;line-height:1.6">
    你已成功订阅！我们实时监控科技投资 Serenity 的推文，AI 深度解读多空逻辑，第一时间推送到你的微信。
    所有历史分析帖子都在 Dashboard 里，用你的 WxPusher UID 直接登录即可查看：
  </p>
  <p style="margin:0 0 16px">
    <a href="https://alphaline.fit/auth/wxpusher"
       style="display:inline-block;padding:10px 20px;background:#1a56db;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
      👉 点击登录 Dashboard
    </a>
  </p>
  <div style="background:#f5f7fa;border-radius:8px;padding:12px 14px;font-size:13px;color:#444">
    <strong>💡 如何查看你的 WxPusher UID？</strong><br/>
    打开 WxPusher App → 底部导航「我的」→ 页面顶部即可看到你的 UID（格式：UID_xxxxxx）
  </div>
</div>
`.trim();

const WELCOME_SUMMARY = "📊 欢迎订阅 Serenity 一手信息（AI 深度解析）";

// WxPusher 回调 body 格式
type WxPusherCallback = {
  action: string;
  data: {
    uid: string;
    topicId?: number;
    time?: number;
  };
};

export const dynamic = "force-dynamic";

// GET — 用于验证 URL 是否可达
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "serenity-wxpusher-webhook",
    timestamp: new Date().toISOString()
  });
}

// POST — WxPusher 推送订阅/取关事件
export async function POST(request: NextRequest) {
  let rawBody: string;
  let payload: WxPusherCallback;

  try {
    rawBody = await request.text();
    logger.info({ rawBody }, "WxPusher webhook received");
    payload = JSON.parse(rawBody) as WxPusherCallback;
  } catch {
    logger.warn("WxPusher webhook: invalid JSON body");
    return NextResponse.json({ ok: false, error: "invalid_json" });
  }

  const action = (payload.action ?? "").toUpperCase();
  const uid = payload.data?.uid;
  const topicId = payload.data?.topicId;

  logger.info({ action, uid, topicId }, "WxPusher webhook parsed");

  // 取关/退款事件 → 撤销 dashboard 权限（管理员不受影响）
  if (action.includes("REMOVE") || action.includes("DEL") || action.includes("CANCEL") || action.includes("UNSUB")) {
    if (uid && !isAdminUid(uid)) {
      try {
        const channel = topicId
          ? await prisma.channel.findFirst({ where: { wxpusherTopicId: String(topicId) } })
          : null;
        if (channel) {
          await revokeChannelAccess(uid, channel.slug);
          logger.info({ uid, channelSlug: channel.slug, action }, "unsubscribe: channel access revoked");
        }
      } catch (err) {
        logger.error({ err, uid }, "failed to revoke channel access on unsubscribe");
      }
    }
    return NextResponse.json({ ok: true, message: "unsubscribe_handled" });
  }

  // 只处理订阅事件
  if (!action.includes("ADD")) {
    logger.info({ action, uid, topicId }, "WxPusher webhook: unhandled action, ignored");
    return NextResponse.json({ ok: true, message: "action_ignored" });
  }

  if (!uid) {
    logger.warn({ payload }, "WxPusher webhook: missing uid");
    return NextResponse.json({ ok: false, error: "missing_uid" });
  }

  // 验证是我们自己的话题
  const expectedTopicId = env.WXPUSHER_TOPIC_ID ? Number(env.WXPUSHER_TOPIC_ID) : null;
  if (expectedTopicId !== null && topicId !== undefined && topicId !== expectedTopicId) {
    logger.info({ topicId, expectedTopicId }, "WxPusher webhook: wrong topic, ignored");
    return NextResponse.json({ ok: true, message: "wrong_topic" });
  }

  // 没有 topicId 的是「应用关注」（免费），不处理
  if (!topicId) {
    logger.info({ uid }, "WxPusher webhook: app follow (no topicId), skipped");
    return NextResponse.json({ ok: true, message: "app_follow_ignored" });
  }

  // 稍等 3 秒，避免 WxPusher API 数据还未更新（付款确认与回调触发存在竞态）
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 查询该用户在此话题的 payEndTime，确认是否是付费订阅
  let expiresAt: Date | null = null;
  let isPaidSubscriber = false;

  try {
    const subs = await fetchTopicSubscribersWithExpiry(String(topicId));
    const sub = subs.find((s) => s.uid === uid);
    if (sub?.payEndTime && sub.payEndTime > Date.now()) {
      expiresAt = new Date(sub.payEndTime);
      isPaidSubscriber = true;
    }
  } catch (err) {
    logger.error({ err, uid }, "failed to fetch subscriber payEndTime");
  }

  if (!isPaidSubscriber) {
    logger.info({ uid, topicId }, "WxPusher webhook: topic subscribe but payEndTime=0, not a paid subscriber, skipped");
    return NextResponse.json({ ok: true, message: "not_paid_subscriber" });
  }

  // ── 付费订阅确认 → 授权 dashboard ────────────────────────────────────────
  let channelSlug: string | null = null;
  try {
    const channel = await prisma.channel.findFirst({
      where: { wxpusherTopicId: String(topicId) }
    });

    if (channel) {
      await grantChannelAccess(uid, channel.slug, expiresAt);
      channelSlug = channel.slug;
      logger.info({ uid, channelSlug, expiresAt }, "paid subscriber granted dashboard access");
    }
  } catch (err) {
    logger.error({ err, uid }, "failed to grant channel access");
  }

  // ── 发送欢迎消息（仅 Serenity 频道，其他频道测试中暂不发） ─────────────────
  if (channelSlug === "serenity") {
    const sendResult = await sendWxPusherToUids(
      [uid],
      WELCOME_HTML,
      WELCOME_SUMMARY,
      "https://alphaline.fit/auth/wxpusher"
    );
    if (sendResult.ok) {
      logger.info({ uid }, "welcome message sent to paid subscriber");
    } else {
      logger.error({ uid, status: sendResult.status, body: sendResult.body }, "welcome message send FAILED");
    }
  }

  return NextResponse.json({ ok: true, message: "paid_subscriber_granted", uid, expiresAt });
}
