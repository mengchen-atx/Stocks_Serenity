/**
 * POST /api/admin/create-password-user
 *
 * 创建账号密码用户（无需本地环境）
 *
 * Authorization: Bearer <WXPUSHER_WEBHOOK_SECRET>
 *
 * Body (JSON):
 *   { username: string, channelSlug?: string, days?: number }
 *
 * Response:
 *   { username, password, uid, channel, expiresAt }
 */

import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  // Auth check
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.WXPUSHER_WEBHOOK_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { username?: string; channelSlug?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim();
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const channelSlug = body.channelSlug ?? "serenity";
  const days = body.days ?? 365;

  const channel = await prisma.channel.findUnique({ where: { slug: channelSlug } });
  if (!channel) {
    return NextResponse.json({ error: `Channel '${channelSlug}' not found` }, { status: 404 });
  }

  const existing = await prisma.passwordUser.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: `Username '${username}' already exists`, uid: existing.uid },
      { status: 409 }
    );
  }

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const uid = `PWD_${randomBytes(8).toString("hex")}`;

  const user = await prisma.passwordUser.create({
    data: { username, passwordHash, uid },
  });

  const expiresAt = days > 0 ? new Date(Date.now() + days * 86400_000) : null;

  await prisma.userChannelAccess.upsert({
    where: { uid_channelId: { uid, channelId: channel.id } },
    create: { uid, channelId: channel.id, expiresAt },
    update: { expiresAt },
  });

  return NextResponse.json({
    username: user.username,
    password,
    uid: user.uid,
    channel: channelSlug,
    expiresAt: expiresAt?.toISOString() ?? "永久",
  });
}
