/**
 * GET /api/admin/access-logs
 *
 * 返回各 UID 的访问频次统计，用于识别异常高频爬虫行为。
 * 支持参数：
 *   ?hours=24   — 统计时间窗口（默认 24 小时）
 *   ?limit=50   — 返回条数（默认 50）
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { isAdminUid } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hours = Math.min(Number(req.nextUrl.searchParams.get("hours") ?? 24), 168); // 最多7天
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  const since = new Date(Date.now() - hours * 3_600_000);

  // 按 UID 聚合：总请求数 + 最早/最晚时间
  const rows = await prisma.accessLog.groupBy({
    by: ["uid"],
    where: { createdAt: { gte: since } },
    _count: { id: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  // 每小时分布（用于判断是否是持续机器访问）
  const topUids = rows.slice(0, 10).map((r) => r.uid);
  const recentLogs = topUids.length
    ? await prisma.accessLog.findMany({
        where: { uid: { in: topUids }, createdAt: { gte: since } },
        select: { uid: true, path: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    : [];

  // 按 UID 分组最近 10 条访问记录
  const recentByUid = new Map<string, typeof recentLogs>();
  for (const log of recentLogs) {
    const list = recentByUid.get(log.uid) ?? [];
    if (list.length < 10) list.push(log);
    recentByUid.set(log.uid, list);
  }

  // 识别 PasswordUser 或 WxPusher UID 对应的账号信息
  const pwdUsers = await prisma.passwordUser.findMany({
    where: { uid: { in: topUids } },
    select: { uid: true, username: true, note: true },
  });
  const pwdMap = new Map(pwdUsers.map((u) => [u.uid, u]));

  const stats = rows.map((r) => {
    const pwd = pwdMap.get(r.uid);
    return {
      uid: r.uid,
      label: pwd ? `${pwd.username}${pwd.note ? ` (${pwd.note})` : ""}` : null,
      count: r._count.id,
      firstSeen: r._min.createdAt?.toISOString() ?? null,
      lastSeen: r._max.createdAt?.toISOString() ?? null,
      // 平均每小时请求数
      perHour: +(r._count.id / Math.max(hours, 1)).toFixed(1),
      recent: (recentByUid.get(r.uid) ?? []).map((l) => ({
        path: l.path,
        time: l.createdAt.toISOString(),
      })),
    };
  });

  // 清理7天前的旧日志（趁机清一下，避免表膨胀）
  prisma.accessLog
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 3_600_000) } } })
    .catch(() => {});

  return NextResponse.json({ hours, stats, total: rows.length });
}
