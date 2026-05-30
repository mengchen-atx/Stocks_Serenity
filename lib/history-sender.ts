/**
 * 新订阅者欢迎消息
 *
 * 当用户扫码订阅 WxPusher 后，立即发送一条欢迎消息，
 * 告知他们可以通过 Dashboard 查看所有历史分析。
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendWxPusherToUids } from "@/lib/wxpusher";

const DASHBOARD_URL = "https://stocks-plum.vercel.app/dashboard";
const LOGIN_URL = "https://stocks-plum.vercel.app/auth/wxpusher";

export async function sendHistoryToSubscriber(uid: string): Promise<void> {
  logger.info({ uid }, "sendHistoryToSubscriber: sending welcome message");

  const welcomeHtml = `
<div style="font-family:sans-serif;max-width:520px;padding:24px;background:#f8fafc;border-radius:12px;">
  <h2 style="color:#0f172a;margin:0 0 16px;">📊 欢迎加入 Serenity Intelligence！</h2>

  <p style="color:#334155;line-height:1.7;margin:0 0 16px;">
    你已成功订阅！我们实时监控科技投资 KOL 推文，AI 深度解读多空逻辑，
    第一时间推送到你的微信。
  </p>

  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;">
    <p style="color:#0f172a;font-weight:600;margin:0 0 8px;">📖 查看历史分析</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px;">
      所有历史分析帖子都在 Dashboard 里，用你的 WxPusher UID 直接登录即可查看：
    </p>
    <a href="${LOGIN_URL}"
       style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
              padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">
      👉 点击登录 Dashboard
    </a>
    <p style="color:#94a3b8;font-size:12px;margin:10px 0 0;">
      ${LOGIN_URL}
    </p>
  </div>

  <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
    · 登录时输入你在 WxPusher App「我的」页面看到的 UID<br/>
    · 每条分析包含原文翻译、AI 解读、利好/利空股票列表<br/>
    · 新帖子实时推送到本微信，无需刷新
  </p>
</div>`.trim();

  const result = await sendWxPusherToUids(
    [uid],
    welcomeHtml,
    "📊 欢迎加入 Serenity Intelligence！点击查看历史分析 →",
    LOGIN_URL
  );

  if (!result.ok) {
    logger.warn({ uid, body: result.body }, "sendHistoryToSubscriber: welcome message failed");

    await prisma.historySendJob.update({
      where: { uid },
      data: { status: "failed", error: result.body }
    }).catch(() => {});
    return;
  }

  await prisma.historySendJob.update({
    where: { uid },
    data: { status: "done", sent: 1, total: 1, doneAt: new Date() }
  }).catch(() => {});

  logger.info({ uid }, "sendHistoryToSubscriber: welcome message sent");
}
