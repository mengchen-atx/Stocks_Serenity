import { NextRequest, NextResponse } from "next/server";
import { createOtp } from "@/lib/wxpusher-auth";
import { sendWxPusherToUids } from "@/lib/wxpusher";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { uid } = await request.json() as { uid?: string };

  if (!uid || !uid.startsWith("UID_")) {
    return NextResponse.json({ error: "请输入正确的 WxPusher UID（以 UID_ 开头）" }, { status: 400 });
  }

  // 限制：只有已订阅应用的 UID 才能收到消息
  // 先发验证码，如果 UID 不存在 WxPusher 会报错
  const code = await createOtp(uid);

  const html = `
<div style="font-family:sans-serif;max-width:400px;padding:20px;">
  <h3 style="color:#1e293b;">🔐 Serenity Dashboard 登录验证</h3>
  <p style="color:#475569;">你的验证码是：</p>
  <div style="font-size:36px;font-weight:bold;color:#2563eb;letter-spacing:8px;padding:16px 0;">${code}</div>
  <p style="color:#94a3b8;font-size:13px;">验证码 ${10} 分钟内有效，请勿分享给他人。</p>
</div>`.trim();

  const result = await sendWxPusherToUids(
    [uid],
    html,
    `Serenity 登录验证码：${code}`,
    null
  );

  if (!result.ok) {
    // 判断是否是"未订阅应用"错误
    const isNotSubscribed = result.body.includes("1001") || result.body.includes("未订阅应用");
    if (isNotSubscribed) {
      return NextResponse.json(
        { error: "该 UID 未订阅应用，请先扫描应用二维码关注后再试" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "发送验证码失败，请检查 UID 是否正确" }, { status: 400 });
  }

  // 脱敏日志
  console.log(`[wxpusher-auth] OTP sent to ${uid.slice(0, 8)}...`);

  return NextResponse.json({ ok: true, message: "验证码已发送到你的微信，请查收" });
}
