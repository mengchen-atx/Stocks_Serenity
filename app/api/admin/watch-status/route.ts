import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminUid } from "@/lib/admin";
import { env } from "@/lib/env";

function isAuthorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.watchUser.findMany({
    where: { enabled: true },
    orderBy: { pollIntervalSeconds: "asc" },
    include: { channel: { select: { slug: true, wxpusherTopicId: true } } },
  });

  // 最近5次 cron 运行
  const recentRuns = await prisma.cronRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 5,
    select: { status: true, fetched: true, pushed: true, error: true, startedAt: true, finishedAt: true },
  });

  const now = Date.now();
  const TICKS_PER_DAY = 1440;

  const watchStatus = await Promise.all(
    users.map(async (u) => {
      const lastTweet = await prisma.tweet.findFirst({
        where: { authorUsername: { equals: u.username, mode: "insensitive" } },
        orderBy: { tweetCreatedAt: "desc" },
        select: { tweetCreatedAt: true, pushed: true, content: true },
      });

      const lastPushed = await prisma.tweet.findFirst({
        where: { authorUsername: { equals: u.username, mode: "insensitive" }, pushed: true },
        orderBy: { tweetCreatedAt: "desc" },
        select: { tweetCreatedAt: true },
      });

      const daysSinceLastTweet = lastTweet
        ? (now - lastTweet.tweetCreatedAt.getTime()) / 86_400_000
        : null;

      const daysSinceLastPush = lastPushed
        ? (now - lastPushed.tweetCreatedAt.getTime()) / 86_400_000
        : null;

      const pollsPerDay =
        u.pollIntervalSeconds <= 60
          ? TICKS_PER_DAY
          : Math.round(TICKS_PER_DAY * (60 / u.pollIntervalSeconds));

      return {
        username: u.username,
        displayName: u.displayName,
        pollIntervalSeconds: u.pollIntervalSeconds,
        pollsPerDay,
        channelSlug: u.channel?.slug ?? null,
        hasTopicId: !!u.channel?.wxpusherTopicId,
        twitterUserIdCached: !!u.twitterUserId,
        lastTweetAt: lastTweet?.tweetCreatedAt ?? null,
        lastTweetDaysAgo: daysSinceLastTweet !== null ? +daysSinceLastTweet.toFixed(1) : null,
        lastPushAt: lastPushed?.tweetCreatedAt ?? null,
        lastPushDaysAgo: daysSinceLastPush !== null ? +daysSinceLastPush.toFixed(1) : null,
        lastTweetPreview: lastTweet?.content?.slice(0, 60) ?? null,
      };
    })
  );

  return NextResponse.json({ recentRuns, watchStatus });
}
