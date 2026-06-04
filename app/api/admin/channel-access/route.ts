/**
 * 管理员频道权限 API
 * GET  /api/admin/channel-access?uid=xxx  → 查询某 UID 的频道权限
 * POST /api/admin/channel-access          → 授权 { uid, channelSlug }
 * DELETE /api/admin/channel-access        → 撤权 { uid, channelSlug }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { grantChannelAccess, revokeChannelAccess } from "@/lib/channels";
import { prisma } from "@/lib/prisma";
import { isAdminUid } from "@/lib/admin";
import { fetchTopicSubscriberUids } from "@/lib/wxpusher";

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

    // 是否是 WxPusher 话题付费订阅者（只查有 topicId 的频道）
    const topicSubscriberSlugs = new Set<string>();
    for (const ch of allChannels) {
      if (!ch.wxpusherTopicId) continue;
      const subs = await fetchTopicSubscriberUids(ch.wxpusherTopicId).catch((): string[] => []);
      if (subs.includes(targetUid)) topicSubscriberSlugs.add(ch.slug);
    }

    const result = allChannels.map((c) => {
      const access = accessMap.get(c.slug);
      const hasAccess = !!access && (access.expiresAt === null || access.expiresAt > now);
      const isTopicSubscriber = topicSubscriberSlugs.has(c.slug);
      const canReceivePush = isTopicSubscriber || (hasAccess && !!access?.grantedManually);

      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        hasAccess,
        expiresAt: access?.expiresAt?.toISOString() ?? null,
        grantedManually: access?.grantedManually ?? false,
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
export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isOwner(uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { uid: targetUid, channelSlug, days } = await req.json() as {
    uid?: string; channelSlug?: string; days?: number;
  };
  if (!targetUid || !channelSlug) return NextResponse.json({ error: "Missing uid or channelSlug" }, { status: 400 });

  const expiresAt = (days !== undefined && days > 0)
    ? new Date(Date.now() + days * 86400_000)
    : null; // 0 或未传 → 永久

  try {
    await grantChannelAccess(targetUid, channelSlug, expiresAt);
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
  if (!targetUid || !channelSlug) return NextResponse.json({ error: "Missing uid or channelSlug" }, { status: 400 });

  try {
    await revokeChannelAccess(targetUid, channelSlug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
