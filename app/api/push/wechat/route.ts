import { PushChannel, PushStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/hash";
import { prisma } from "@/lib/prisma";
import { sendWechatMarkdown } from "@/lib/wechat";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { tweetId?: string; content?: string };
  if (!body.content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const sent = await sendWechatMarkdown(body.content);
  const payloadHash = sha256(body.content);

  if (body.tweetId) {
    const tweet = await prisma.tweet.findUnique({ where: { tweetId: body.tweetId } });
    if (tweet) {
      await prisma.pushLog.upsert({
        where: {
          tweetId_channel_payloadHash: {
            tweetId: tweet.id,
            channel: PushChannel.WECHAT_WORK_BOT,
            payloadHash
          }
        },
        create: {
          tweetId: tweet.id,
          channel: PushChannel.WECHAT_WORK_BOT,
          status: sent.ok ? PushStatus.SENT : PushStatus.FAILED,
          payloadHash,
          responseStatus: sent.status,
          responseBody: sent.body
        },
        update: {
          status: sent.ok ? PushStatus.SENT : PushStatus.FAILED,
          responseStatus: sent.status,
          responseBody: sent.body
        }
      });
      if (sent.ok) await prisma.tweet.update({ where: { id: tweet.id }, data: { pushed: true } });
    }
  }

  return NextResponse.json(sent);
}
