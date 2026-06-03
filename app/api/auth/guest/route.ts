import { NextResponse } from "next/server";
import { verifyGuestToken } from "@/lib/guest-auth";
import { issueSessionCookie } from "@/lib/wxpusher-auth";
import { checkChannelAccess } from "@/lib/channels";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/wxpusher?error=missing_token", origin));
  }

  const decoded = verifyGuestToken(token);
  if (!decoded) {
    return NextResponse.redirect(new URL("/auth/wxpusher?error=invalid_token", origin));
  }

  // Confirm this UID still has Serenity channel access in DB
  const channel = await checkChannelAccess(decoded.uid, "serenity");
  if (!channel) {
    return NextResponse.redirect(new URL("/auth/wxpusher?error=access_expired", origin));
  }

  await issueSessionCookie(decoded.uid);
  return NextResponse.redirect(new URL("/dashboard/serenity", origin));
}
