import { NextRequest, NextResponse } from "next/server";
import { analyzeTweetWithAi } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { tweetId?: string; content?: string };
  const content =
    body.content ??
    (body.tweetId
      ? (await prisma.tweet.findUnique({ where: { tweetId: body.tweetId } }))?.content
      : null);

  if (!content) {
    return NextResponse.json({ error: "content or tweetId is required" }, { status: 400 });
  }

  const analysis = await analyzeTweetWithAi(content);

  if (body.tweetId) {
    await prisma.tweet.update({
      where: { tweetId: body.tweetId },
      data: {
        translatedContent: analysis.translated_content_cn,
        aiAnalysis: analysis
      }
    });
  }

  return NextResponse.json(analysis);
}
