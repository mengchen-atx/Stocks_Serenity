import { NextResponse } from "next/server";
import { verifyGuestToken } from "@/lib/guest-auth";
import { buildSessionCookie } from "@/lib/wxpusher-auth";
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

  // Confirm UID still has active Serenity access in DB
  const channel = await checkChannelAccess(decoded.uid, "serenity");
  if (!channel) {
    return NextResponse.redirect(new URL("/auth/wxpusher?error=access_expired", origin));
  }

  // Set cookie directly on the redirect response.
  // iOS Safari drops cookies that are set via cookies() helper when the
  // response is a redirect — setting on the response object itself is reliable.
  const response = NextResponse.redirect(new URL("/dashboard/serenity", origin));
  const { name, value, options } = buildSessionCookie(decoded.uid);
  response.cookies.set(name, value, options);
  return response;
}
