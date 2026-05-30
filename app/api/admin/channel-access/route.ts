/**
 * 管理员频道权限 API
 * GET  /api/admin/channel-access?uid=xxx  → 查询某 UID 的频道权限
 * POST /api/admin/channel-access          → 授权 { uid, channelSlug }
 * DELETE /api/admin/channel-access        → 撤权 { uid, channelSlug }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { grantChannelAccess, revokeChannelAccess, getUserChannels, getAllChannels } from "@/lib/channels";
import { prisma } from "@/lib/prisma";

function isOwner(uid: string) {
  return uid === process.env.WXPUSHER_OWNER_UID;
}

// GET：查询所有频道列表 + 指定 UID 的权限（若传 uid 参数）
export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isOwner(uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const targetUid = req.nextUrl.searchParams.get("uid");
  const channels = await getAllChannels();

  if (targetUid) {
    const userChannels = await getUserChannels(targetUid);
    const accessSlugs = new Set(userChannels.map((c) => c.slug));
    return NextResponse.json({
      channels: channels.map((c) => ({ ...c, hasAccess: accessSlugs.has(c.slug) })),
    });
  }

  // 返回所有频道 + 每个频道的订阅人数
  const counts = await prisma.userChannelAccess.groupBy({
    by: ["channelId"],
    _count: { uid: true },
  });
  const countMap = new Map(counts.map((r) => [r.channelId, r._count.uid]));

  return NextResponse.json({
    channels: channels.map((c) => ({ ...c, subscriberCount: countMap.get(c.id) ?? 0 })),
  });
}

// POST：授权
export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid || !isOwner(uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { uid: targetUid, channelSlug } = await req.json();
  if (!targetUid || !channelSlug) return NextResponse.json({ error: "Missing uid or channelSlug" }, { status: 400 });

  try {
    await grantChannelAccess(targetUid, channelSlug);
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
