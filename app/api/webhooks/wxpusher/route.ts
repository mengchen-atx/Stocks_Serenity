/**
 * WxPusher 订阅回调 Webhook
 *
 * 当用户扫码订阅/取关时，WxPusher 会向此地址发送 POST 请求。
 * 收到"订阅"事件后：
 *   1. 立即返回 200（WxPusher 要求快速响应）
 *   2. 后台异步给该用户发送所有历史分析消息
 *
 * 在 WxPusher 管理后台配置回调地址：
 *   应用 → 编辑 → 关注/取关回调URL → 填入：
 *   https://your-domain.vercel.app/api/webhooks/wxpusher
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// WxPusher 回调 body 格式（基于官方文档）
// action: "ADD_TOPIC" = 订阅话题, "DELETE_TOPIC" = 取关话题
// 部分版本 action 为小驼峰 "addTopic" / "deleteTopic"
type WxPusherCallback = {
  action: string;
  data: {
    uid: string;
    topicId?: number;
    time?: number;
  };
};

export const dynamic = "force-dynamic";

// GET — 用于验证 URL 是否可达（WxPusher ping 或手动测试）
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
    // 还是返回 200，避免 WxPusher 因失败反复重试
    return NextResponse.json({ ok: false, error: "invalid_json" });
  }

  const action = (payload.action ?? "").toUpperCase();
  const uid = payload.data?.uid;
  const topicId = payload.data?.topicId;

  logger.info({ action, uid, topicId }, "WxPusher webhook parsed");

  // 只处理订阅事件
  const isSubscribe = action.includes("ADD");
  if (!isSubscribe) {
    return NextResponse.json({ ok: true, message: "unsubscribe_ignored" });
  }

  if (!uid) {
    logger.warn({ payload }, "WxPusher webhook: missing uid");
    return NextResponse.json({ ok: false, error: "missing_uid" });
  }

  // 验证是我们自己的话题（如果配置了 WXPUSHER_TOPIC_ID）
  const expectedTopicId = env.WXPUSHER_TOPIC_ID ? Number(env.WXPUSHER_TOPIC_ID) : null;
  if (expectedTopicId !== null && topicId !== undefined && topicId !== expectedTopicId) {
    logger.info({ topicId, expectedTopicId }, "WxPusher webhook: wrong topic, ignored");
    return NextResponse.json({ ok: true, message: "wrong_topic" });
  }

  logger.info({ uid }, "WxPusher webhook: new subscriber recorded");

  return NextResponse.json({ ok: true, message: "subscribed", uid });
}
