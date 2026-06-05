/**
 * 管理员频道权限 API
 * GET  /api/admin/channel-access?uid=xxx  → 查询某 UID 的频道权限
 * POST /api/admin/channel-access          → 单频道授权 { uid, channelSlug, days }
 *                                           或批量授权 { uid, grants: [{slug, dashboardDays, pushDays}] }
 * DELETE /api/admin/channel-access        → 撤权 { uid, channelSlug }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { grantChannelAccess, revokeChannelAccess } from "@/lib/channels";
import { prisma } from "@/lib/prisma";
import { isAdminUid } from "@/lib/admin";
import { fetchTopicSubscribersWithExpiry } from "@/lib/wxpusher";

function isOwner(uid: string) {
  return isAdminUid(uid);
}

// GET：查询所有频道列表 + 指定 UID 的权限（若传 uid 参数）
export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isOwner(uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const targetUid = req.nextUrl.searchParams.get("uid");

  // 所有频道（含 wxpusherTopicId，直接查 DB）
  const allChannels = await prisma.channel.findMany({ orderBy: { createdAt: "asc" } });

  if (targetUid) {
    const now = new Date();

    // 该 UID 的所有频道权限记录
    const accesses = await prisma.userChannelAccess.findMany({
      where: { uid: targetUid },
      include: { channel: { select: { slug: true } } },
    });
    const accessMap = new Map(accesses.map((a) => [a.channel.slug, a]));

    // WxPusher 话题付费订阅者 + payEndTime（只查有 topicId 的频道）
    const topicPayEndMap = new Map<string, number | null>();
    for (const ch of allChannels) {
      if (!ch.wxpusherTopicId) continue;
      const subs = await fetchTopicSubscribersWithExpiry(ch.wxpusherTopicId).catch(() => []);
      const sub = subs.find((s) => s.uid === targetUid);
      if (sub) topicPayEndMap.set(ch.slug, sub.payEndTime ?? null);
    }

    const result = allChannels.map((c) => {
      const access = accessMap.get(c.slug);
      const hasAccess = !!access && (access.expiresAt === null || access.expiresAt > now);
      const isTopicSubscriber = topicPayEndMap.has(c.slug);

      // DB 里是否设了推送到期时间（管理员主动设置的，优先于 WxPusher 的 payEndTime）
      const dbPushExpiresAt = access?.pushExpiresAt ?? null;
      const dbPushExpired = dbPushExpiresAt !== null && dbPushExpiresAt <= now;

      // 能收到推送：未被 DB 限期到期，且（话题订阅 or 手动开启推送）
      const canReceivePush = !dbPushExpired && (
        isTopicSubscriber ||
        (!!access?.pushEnabled && (dbPushExpiresAt === null || dbPushExpiresAt > now))
      );

      // 显示的推送到期时间：DB 显式设置优先；否则用 WxPusher payEndTime
      const topicPayEnd = topicPayEndMap.get(c.slug);
      const pushExpiresAt = dbPushExpiresAt !== null
        ? dbPushExpiresAt.toISOString()
        : isTopicSubscriber
          ? (topicPayEnd ? new Date(topicPayEnd).toISOString() : null)
          : null;

      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        hasAccess,
        expiresAt: access?.expiresAt?.toISOString() ?? null,
        grantedManually: access?.grantedManually ?? false,
        pushEnabled: access?.pushEnabled ?? false,
        pushExpiresAt,
        isTopicSubscriber,
        canReceivePush,
      };
    });

    return NextResponse.json({ channels: result });
  }

  // 返回所有频道 + 每个频道的订阅人数
  const counts = await prisma.userChannelAccess.groupBy({
    by: ["channelId"],
    _count: { uid: true },
  });
  const countMap = new Map(counts.map((r) => [r.channelId, r._count.uid]));

  return NextResponse.json({
    channels: allChannels.map((c) => ({
      id: c.id, slug: c.slug, name: c.name,
      subscriberCount: countMap.get(c.id) ?? 0,
    })),
  });
}

// POST：授权
// 格式1（单频道）: { uid, channelSlug, days }
// 格式2（批量）:   { uid, grants: [{slug, dashboardDays, pushDays}] }
export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isOwner(uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // 格式2：批量授权
  if (body.grants) {
    const { uid: targetUid, grants } = body as {
      uid?: string;
      grants?: { slug: string; dashboardDays: number | null; pushDays: number | null }[];
    };
    if (!targetUid || !Array.isArray(grants)) {
      return NextResponse.json({ error: "Missing uid or grants" }, { status: 400 });
    }

    try {
      for (const g of grants) {
        const hasDashboard = g.dashboardDays !== null;
        const hasPush = g.pushDays !== null;
        if (!hasDashboard && !hasPush) continue; // skip fully disabled channels

        const expiresAt = hasDashboard
          ? (g.dashboardDays! > 0 ? new Date(Date.now() + g.dashboardDays! * 86400_000) : null)
          : null; // no dashboard access

        const pushExpiresAt = hasPush
          ? (g.pushDays! > 0 ? new Date(Date.now() + g.pushDays! * 86400_000) : null)
          : null;

        if (hasDashboard) {
          // Grant dashboard (and optionally push)
          await grantChannelAccess(targetUid, g.slug, expiresAt, {
            pushEnabled: hasPush,
            pushExpiresAt: hasPush ? pushExpiresAt : undefined,
          });
        } else {
          // Push only — upsert with no dashboard expiry but pushEnabled
          const channel = await prisma.channel.findUnique({ where: { slug: g.slug } });
          if (!channel) continue;
          await prisma.userChannelAccess.upsert({
            where: { uid_channelId: { uid: targetUid, channelId: channel.id } },
            create: {
              uid: targetUid,
              channelId: channel.id,
              expiresAt: null,
              grantedManually: true,
              pushEnabled: true,
              pushExpiresAt,
            },
            update: {
              pushEnabled: true,
              pushExpiresAt,
              grantedManually: true,
            },
          });
        }
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
  }

  // 格式1：单频道授权
  const { uid: targetUid, channelSlug, days } = body as {
    uid?: string; channelSlug?: string; days?: number;
  };
  if (!targetUid || !channelSlug) {
    return NextResponse.json({ error: "Missing uid or channelSlug" }, { status: 400 });
  }

  const expiresAt = (days !== undefined && days > 0)
    ? new Date(Date.now() + days * 86400_000)
    : null;

  try {
    await grantChannelAccess(targetUid, channelSlug, expiresAt);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

// PATCH：修改推送有效期（也可用于已是话题订阅者的用户，DB 限期优先）
// Body: { uid, channelSlug, pushDays }  pushDays=0 永久, >0 N天
export async function PATCH(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isOwner(uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { uid: targetUid, channelSlug, pushDays } = await req.json() as {
    uid?: string; channelSlug?: string; pushDays?: number;
  };
  if (!targetUid || !channelSlug || pushDays === undefined) {
    return NextResponse.json({ error: "Missing uid, channelSlug, or pushDays" }, { status: 400 });
  }

  const channel = await prisma.channel.findUnique({ where: { slug: channelSlug } });
  if (!channel) return NextResponse.json({ error: `Channel not found: ${channelSlug}` }, { status: 404 });

  const pushExpiresAt = pushDays > 0
    ? new Date(Date.now() + pushDays * 86400_000)
    : null; // 0 = 永久

  try {
    await prisma.userChannelAccess.upsert({
      where: { uid_channelId: { uid: targetUid, channelId: channel.id } },
      create: { uid: targetUid, channelId: channel.id, grantedManually: true, pushEnabled: true, pushExpiresAt },
      update: { pushEnabled: true, pushExpiresAt, grantedManually: true },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

// DELETE：撤权
export async function DELETE(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isOwner(uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { uid: targetUid, channelSlug } = await req.json();
  if (!targetUid || !channelSlug) {
    return NextResponse.json({ error: "Missing uid or channelSlug" }, { status: 400 });
  }

  try {
    await revokeChannelAccess(targetUid, channelSlug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
