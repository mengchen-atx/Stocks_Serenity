/**
 * 新订阅者欢迎消息
 *
 * 当用户扫码订阅 WxPusher 后，立即发送一条欢迎消息，
 * 告知他们可以通过 Dashboard 查看所有历史分析。
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendWxPusherToUids } from "@/lib/wxpusher";

const DASHBOARD_URL = "https://alphaline.fit/dashboard";
const LOGIN_URL = "https://alphaline.fit/auth/wxpusher";

export async function sendHistoryToSubscriber(uid: string): Promise<void> {
  logger.info({ uid }, "sendHistoryToSubscriber: sending welcome message");

  const welcomeHtml = `
<div style="font-family:sans-serif;max-width:520px;padding:24px;background:#f8fafc;border-radius:12px;">
  <h2 style="color:#0f172a;margin:0 0 16px;">📊 欢迎加入 Serenity一手信息(AI深度解析）</h2>

  <p style="color:#334155;line-height:1.7;margin:0 0 16px;">
    你已成功订阅！我们实时监控科技投资 Serenity 的推文，AI 深度解读多空逻辑，
    第一时间推送到你的微信。所有历史分析帖子都在 Dashboard 里，用你的 WxPusher UID 直接登录即可查看：
  </p>

  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;">
    <a href="${LOGIN_URL}"
       style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
              padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">
      👉 点击登录 Dashboard
    </a>
    <p style="color:#94a3b8;font-size:12px;margin:10px 0 0;">
      ${LOGIN_URL}
    </p>
  </div>

  <div style="background:#fef9c3;border-radius:8px;padding:12px 16px;margin-bottom:0;">
    <p style="color:#713f12;font-size:13px;line-height:1.6;margin:0;">
      💡 <strong>如何查看你的 WxPusher UID？</strong><br/>
      打开 WxPusher App → 底部导航「我的」→ 页面顶部即可看到你的 UID（格式：UID_xxxxxx）
    </p>
  </div>
</div>`.trim();

  const result = await sendWxPusherToUids(
    [uid],
    welcomeHtml,
    "📊 欢迎加入 Serenity一手信息！点此登录 Dashboard 查看历史分析 →",
    LOGIN_URL
  );

  if (!result.ok) {
    logger.warn({ uid, body: result.body }, "sendHistoryToSubscriber: welcome message failed");

    await prisma.historySendJob.upsert({
      where: { uid },
      create: { uid, status: "failed", error: result.body },
      update: { status: "failed", error: result.body }
    }).catch(() => {});
    return;
  }

  await prisma.historySendJob.upsert({
    where: { uid },
    create: { uid, status: "done", sent: 1, total: 1, doneAt: new Date() },
    update: { status: "done", sent: 1, total: 1, doneAt: new Date() }
  }).catch(() => {});

  logger.info({ uid }, "sendHistoryToSubscriber: welcome message sent");
}
