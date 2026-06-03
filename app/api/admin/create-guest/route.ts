/**
 * Admin endpoint: generate a 30-day guest login link (server-side).
 * Using server-side generation ensures the HMAC uses production secrets.
 *
 * Usage:
 *   curl -X POST https://www.alphaline.fit/api/admin/create-guest \
 *     -H "Authorization: Bearer <WXPUSHER_WEBHOOK_SECRET>"
 */

import { NextResponse } from "next/server";
import { grantChannelAccess } from "@/lib/channels";
import { generateGuestUid, generateGuestToken } from "@/lib/guest-auth";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.WXPUSHER_WEBHOOK_SECRET ?? "";
const BASE_URL = process.env.APP_BASE_URL ?? "https://www.alphaline.fit";
const DAYS = 30;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!ADMIN_SECRET || auth !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const uid = generateGuestUid();
  const expiresAt = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000);

  await grantChannelAccess(uid, "serenity", expiresAt);

  const token = generateGuestToken(uid, expiresAt);
  const url = `${BASE_URL}/api/auth/guest?token=${token}`;

  return NextResponse.json({
    uid,
    channel: "serenity",
    expiresAt: expiresAt.toISOString(),
    url,
  });
}
