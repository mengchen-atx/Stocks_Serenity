/**
 * GET  /api/admin/password-users        — 列出所有账号密码用户
 * DELETE /api/admin/password-users      — 删除用户 body: { uid }
 *
 * 仅管理员 session 可访问（server-side 双重校验，不依赖页面层）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { isAdminUid } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getSessionUid();
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.passwordUser.findMany({
    orderBy: { createdAt: "desc" },
  });

  const uids = users.map((u) => u.uid);

  const accesses = uids.length
    ? await prisma.userChannelAccess.findMany({
        where: { uid: { in: uids } },
        include: { channel: { select: { slug: true, name: true } } },
      })
    : [];

  const accessMap = new Map<string, typeof accesses>();
  for (const a of accesses) {
    const list = accessMap.get(a.uid) ?? [];
    list.push(a);
    accessMap.set(a.uid, list);
  }

  const result = users.map((u) => ({
    uid: u.uid,
    username: u.username,
    note: u.note,
    createdAt: u.createdAt.toISOString(),
    channels: (accessMap.get(u.uid) ?? []).map((a) => ({
      slug: a.channel.slug,
      name: a.channel.name,
      expiresAt: a.expiresAt?.toISOString() ?? null,
    })),
  }));

  return NextResponse.json({ users: result });
}

export async function DELETE(req: NextRequest) {
  const sessionUid = await getSessionUid();
  if (!sessionUid || !isAdminUid(sessionUid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { uid } = (await req.json()) as { uid?: string };
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  // 删除频道权限 + 用户记录（级联）
  await prisma.userChannelAccess.deleteMany({ where: { uid } });
  await prisma.passwordUser.delete({ where: { uid } });

  return NextResponse.json({ ok: true });
}
