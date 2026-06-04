/**
 * PATCH /api/admin/password-users/extend
 *
 * 修改某用户某频道的有效期（延期 / 改期 / 设为永久）
 *
 * Body: { uid: string, channelSlug: string, days: number }
 *   days = 0 → 永久
 *   days > 0 → 从现在起 days 天后到期（不叠加，直接覆盖）
 */

import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { isAdminUid } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const uid = await getSessionUid();
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid: targetUid, channelSlug, days } = (await req.json()) as {
    uid?: string;
    channelSlug?: string;
    days?: number;
  };

  if (!targetUid || !channelSlug || days === undefined) {
    return NextResponse.json({ error: "uid, channelSlug and days are required" }, { status: 400 });
  }

  const channel = await prisma.channel.findUnique({ where: { slug: channelSlug } });
  if (!channel) {
    return NextResponse.json({ error: `频道不存在: ${channelSlug}` }, { status: 404 });
  }

  const expiresAt = days > 0 ? new Date(Date.now() + days * 86400_000) : null;

  const updated = await prisma.userChannelAccess.upsert({
    where: { uid_channelId: { uid: targetUid, channelId: channel.id } },
    create: { uid: targetUid, channelId: channel.id, expiresAt },
    update: { expiresAt },
  });

  return NextResponse.json({
    ok: true,
    expiresAt: updated.expiresAt?.toISOString() ?? null,
  });
}
