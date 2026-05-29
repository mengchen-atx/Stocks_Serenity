import { NextRequest, NextResponse } from "next/server";
import { checkWxPusherPayment, issueSessionCookie } from "@/lib/wxpusher-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { uid } = await request.json() as { uid?: string };

  if (!uid || !uid.startsWith("UID_")) {
    return NextResponse.json(
      { error: "请输入正确的 WxPusher UID（以 UID_ 开头）" },
      { status: 400 }
    );
  }

  const { isPaid, expiresAt, isOwner } = await checkWxPusherPayment(uid.trim());

  if (!isPaid) {
    const msg = expiresAt
      ? `订阅已于 ${expiresAt.toLocaleDateString("zh-CN")} 到期，请续费后再登录`
      : "该 UID 暂无有效订阅";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  await issueSessionCookie(uid.trim());

  return NextResponse.json({
    ok: true,
    message: isOwner ? "管理员登录成功" : "登录成功",
  });
}
