import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/wxpusher-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await clearSessionCookie();
  const origin = request.nextUrl.origin;
  return NextResponse.redirect(`${origin}/auth/wxpusher`, 303);
}
