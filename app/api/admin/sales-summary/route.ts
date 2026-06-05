/**
 * 管理员销售统计 API
 * GET /api/admin/sales-summary
 *
 * 返回每个管理员的授权统计：
 * - 授权总人次（含多频道，每个频道独立计）
 * - 授权独立用户数（去重 uid）
 * - 当前有效授权数
 * - 已过期授权数
 * - 最近 10 条授权记录
 */

import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { isAdminUid, getAdminUids } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getSessionUid();
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminUids = getAdminUids();
  const now = new Date();

  // 所有手动授权记录（含 grantedBy）
  const allGrants = await prisma.userChannelAccess.findMany({
    where: { grantedManually: true },
    select: {
      uid: true,
      grantedBy: true,
      grantedAt: true,
      expiresAt: true,
      pushEnabled: true,
      pushExpiresAt: true,
      channel: { select: { slug: true, name: true } },
    },
    orderBy: { grantedAt: "desc" },
  });

  // 按 grantedBy 分组统计
  const statsMap = new Map<string, {
    total: number;
    uniqueUids: Set<string>;
    active: number;
    expired: number;
    recent: Array<{
      uid: string;
      channelSlug: string;
      channelName: string;
      grantedAt: string;
      expiresAt: string | null;
      pushEnabled: boolean;
    }>;
  }>();

  // 初始化所有管理员
  for (const adminUid of adminUids) {
    statsMap.set(adminUid, { total: 0, uniqueUids: new Set(), active: 0, expired: 0, recent: [] });
  }
  // 未知操作者（grantedBy=null，历史记录）
  statsMap.set("unknown", { total: 0, uniqueUids: new Set(), active: 0, expired: 0, recent: [] });

  for (const g of allGrants) {
    const key = (g.grantedBy && adminUids.includes(g.grantedBy)) ? g.grantedBy : "unknown";
    const stat = statsMap.get(key)!;

    stat.total++;
    stat.uniqueUids.add(g.uid);

    const isActive = g.expiresAt === null || g.expiresAt > now;
    if (isActive) stat.active++;
    else stat.expired++;

    if (stat.recent.length < 10) {
      stat.recent.push({
        uid: g.uid,
        channelSlug: g.channel.slug,
        channelName: g.channel.name,
        grantedAt: g.grantedAt.toISOString(),
        expiresAt: g.expiresAt?.toISOString() ?? null,
        pushEnabled: g.pushEnabled,
      });
    }
  }

  const result = Array.from(statsMap.entries()).map(([adminUid, stat]) => ({
    adminUid,
    total: stat.total,
    uniqueUsers: stat.uniqueUids.size,
    active: stat.active,
    expired: stat.expired,
    recent: stat.recent,
  }));

  return NextResponse.json({ summary: result });
}
