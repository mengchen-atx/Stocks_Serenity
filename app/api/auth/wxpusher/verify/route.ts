import { NextRequest, NextResponse } from "next/server";
import { verifyOtp, checkWxPusherPayment, issueSessionCookie } from "@/lib/wxpusher-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { uid, code } = await request.json() as { uid?: string; code?: string };

  if (!uid || !code) {
    return NextResponse.json({ error: "缺少 UID 或验证码" }, { status: 400 });
  }

  // 1. 校验验证码
  const otpValid = await verifyOtp(uid, code.trim());
  if (!otpValid) {
    return NextResponse.json({ error: "验证码错误或已过期，请重新获取" }, { status: 401 });
  }

  // 2. 检查付费状态
  const { isPaid, expiresAt, isOwner } = await checkWxPusherPayment(uid);
  if (!isPaid) {
    const expiredMsg = expiresAt
      ? `订阅已于 ${expiresAt.toLocaleDateString("zh-CN")} 到期，请续费后再登录`
      : "该账号暂无有效订阅，请先订阅付费套餐";
    return NextResponse.json({ error: expiredMsg }, { status: 403 });
  }

  // 3. 签发 session cookie
  await issueSessionCookie(uid);

  return NextResponse.json({
    ok: true,
    message: isOwner ? "管理员登录成功" : "登录成功",
    expiresAt: expiresAt?.toISOString() ?? null
  });
}
