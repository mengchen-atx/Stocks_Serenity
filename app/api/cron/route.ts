import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runSerenityPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (env.CRON_SECRET && headerSecret !== env.CRON_SECRET && querySecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSerenityPipeline();
  return NextResponse.json(result);
}
