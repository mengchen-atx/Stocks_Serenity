/**
 * POST /api/admin/password-users/create
 *
 * 供 /ops 管理页面调用，用 session cookie 鉴权（isAdminUid）
 *
 * Body:
 *   { username: string, channels: { slug: string, days: number }[] }
 *
 * days = 0 → 永久有效
 */

import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { isAdminUid } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password-auth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

type ChannelEntry = { slug: string; days: number };

export async function POST(req: Request) {
  const uid = await getSessionUid();
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    username?: string;
    channels?: ChannelEntry[];
    // Legacy: support old format for backward compat
    channelSlugs?: string[];
    days?: number;
  };

  const { username } = body;
  if (!username?.trim()) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  // Normalize to per-channel entries (support both old and new format)
  let channelEntries: ChannelEntry[];
  if (body.channels && body.channels.length > 0) {
    channelEntries = body.channels;
  } else if (body.channelSlugs && body.channelSlugs.length > 0) {
    // Legacy single-days format
    const days = body.days ?? 30;
    channelEntries = body.channelSlugs.map((slug) => ({ slug, days }));
  } else {
    return NextResponse.json({ error: "至少选择一个频道" }, { status: 400 });
  }

  const slugs = channelEntries.map((e) => e.slug);

  // Validate all channels exist
  const channels = await prisma.channel.findMany({
    where: { slug: { in: slugs } },
  });
  const foundSlugs = channels.map((c) => c.slug);
  const missing = slugs.filter((s) => !foundSlugs.includes(s));
  if (missing.length) {
    return NextResponse.json({ error: `频道不存在: ${missing.join(", ")}` }, { status: 404 });
  }

  const existing = await prisma.passwordUser.findUnique({ where: { username: username.trim() } });
  if (existing) {
    return NextResponse.json(
      { error: `用户名「${username}」已存在` },
      { status: 409 },
    );
  }

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const newUid = `PWD_${randomBytes(8).toString("hex")}`;

  const user = await prisma.passwordUser.create({
    data: { username: username.trim(), passwordHash, uid: newUid },
  });

  // Grant access per channel with individual expiry
  const channelResults: Array<{ slug: string; expiresAt: string }> = [];
  for (const entry of channelEntries) {
    const channel = channels.find((c) => c.slug === entry.slug);
    if (!channel) continue;
    const expiresAt = entry.days > 0 ? new Date(Date.now() + entry.days * 86400_000) : null;
    await prisma.userChannelAccess.upsert({
      where: { uid_channelId: { uid: newUid, channelId: channel.id } },
      create: { uid: newUid, channelId: channel.id, expiresAt },
      update: { expiresAt },
    });
    channelResults.push({
      slug: entry.slug,
      expiresAt: expiresAt?.toISOString() ?? "永久",
    });
  }

  return NextResponse.json({
    username: user.username,
    password,
    uid: user.uid,
    channels: channelResults,
  });
}
