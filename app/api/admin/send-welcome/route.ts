/**
 * POST /api/admin/send-welcome
 * Body: { uid: string }
 * 向指定 WxPusher UID 发送欢迎消息
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { isAdminUid } from "@/lib/admin";
import { sendWxPusherToUids } from "@/lib/wxpusher";

const LOGIN_URL = "https://alphaline.fit/auth/wxpusher";

const WELCOME_HTML = `
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
    <p style="color:#94a3b8;font-size:12px;margin:10px 0 0;">${LOGIN_URL}</p>
  </div>
  <div style="background:#fef9c3;border-radius:8px;padding:12px 16px;">
    <p style="color:#713f12;font-size:13px;line-height:1.6;margin:0;">
      💡 <strong>如需续费或有问题，请联系管理员 Wx：PM112629</strong>
    </p>
  </div>
</div>`.trim();

export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { uid: targetUid } = await req.json() as { uid?: string };
  if (!targetUid?.trim()) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  const result = await sendWxPusherToUids(
    [targetUid.trim()],
    WELCOME_HTML,
    "📊 欢迎加入 Serenity一手信息！点此登录 Dashboard 查看历史分析 →",
    LOGIN_URL
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.body }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
