import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runSerenityPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return true;

  // Support multiple auth styles:
  // 1. Authorization: Bearer <secret>   (GitHub Actions / curl standard)
  // 2. x-cron-secret: <secret>          (Vercel cron)
  // 3. ?secret=<secret>                 (quick URL test)
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const xCron = request.headers.get("x-cron-secret");
  const query = request.nextUrl.searchParams.get("secret");

  return bearer === env.CRON_SECRET || xCron === env.CRON_SECRET || query === env.CRON_SECRET;
}

// GET — called by Vercel Cron
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  waitUntil(
    runSerenityPipeline().catch((err) => {
      logger.error({ err }, "cron tick failed");
    })
  );
  return NextResponse.json({ ok: true, started: true });
}

// POST — called by GitHub Actions / curl / external schedulers
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  waitUntil(
    runSerenityPipeline().catch((err) => {
      logger.error({ err }, "cron tick failed");
    })
  );
  return NextResponse.json({ ok: true, started: true });
}
