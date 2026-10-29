import { NextResponse } from "next/server";
import { buildSessionCookie } from "@/lib/wxpusher-auth";
import { createGuestUid, GUEST_SESSION_DAYS } from "@/lib/guest";

export const dynamic = "force-dynamic";

// One-click guest entry: shareable link (e.g. on a resume) that signs the visitor in as a guest.
export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  const { name, value, options } = buildSessionCookie(createGuestUid(), GUEST_SESSION_DAYS);
  response.cookies.set(name, value, options);
  return response;
}
