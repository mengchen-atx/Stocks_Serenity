import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { renderTelegramMessage, sendTelegramMessage } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { enrichStocks } from "@/lib/stocks";
import type { AiAnalysis } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Verify secret
  const headerSecret = request.headers.get("x-cron-secret");
  if (env.CRON_SECRET && headerSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { tweetId: string };
  if (!body.tweetId) {
    return NextResponse.json({ error: "tweetId is required" }, { status: 400 });
  }

  const tweet = await prisma.tweet.findUnique({ where: { tweetId: body.tweetId } });
  if (!tweet) {
    return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
  }

  const analysis = tweet.aiAnalysis as AiAnalysis | null;
  if (!analysis) {
    return NextResponse.json({ error: "Tweet not analyzed yet" }, { status: 400 });
  }

  const tickers = [
    ...analysis.bullish_stocks.map((s) => s.ticker),
    ...analysis.bearish_stocks.map((s) => s.ticker)
  ];
  const stocks = await enrichStocks(tickers);

  const content = renderTelegramMessage({
    sourceUrl: tweet.sourceUrl,
    original: tweet.content,
    authorUsername: tweet.authorUsername,
    analysis,
    stocks
  });

  const result = await sendTelegramMessage(content);
  return NextResponse.json(result);
}
