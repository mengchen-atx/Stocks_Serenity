import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runSerenityPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 外部定时器（cron-job.org / GitHub Actions）目前最快只能做到「每分钟触发一次」。
// 为了把实际抓取频率提到约 30 秒一次，这里在单次触发里"跑两轮"：
// 立即抓一次 → 等 30 秒 → 再抓一次。两轮总耗时远小于 maxDuration=300s 的预算，
// 且 handleTweet 内部按 tweetId/contentHash/pushed 去重，多触发不会导致重复推送。
const TICK_INTERVAL_MS = 30_000;

async function runDoubleTick() {
  await runSerenityPipeline().catch((err) => {
    logger.error({ err }, "cron tick (1/2) failed");
  });

  await new Promise((resolve) => setTimeout(resolve, TICK_INTERVAL_MS));

  await runSerenityPipeline().catch((err) => {
    logger.error({ err }, "cron tick (2/2) failed");
  });
}

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
  // 立即返回 200，后台跑两轮抓取（间隔 30 秒），避免 Vercel 函数超时
  waitUntil(runDoubleTick());
  return NextResponse.json({ ok: true, started: true, ticks: 2, intervalMs: TICK_INTERVAL_MS });
}

// POST — called by GitHub Actions / curl / external schedulers
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 立即返回 200，后台跑两轮抓取（间隔 30 秒），避免 Vercel 函数超时
  waitUntil(runDoubleTick());
  return NextResponse.json({ ok: true, started: true, ticks: 2, intervalMs: TICK_INTERVAL_MS });
}
