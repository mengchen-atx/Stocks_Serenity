import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { fetchLatestTweets } from "@/lib/twitter";
import { sha256 } from "@/lib/hash";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await prisma.watchUser.upsert({
    where: { username: env.TWITTER_USERNAME },
    create: {
      username: env.TWITTER_USERNAME,
      includeReplies: env.TWITTER_INCLUDE_REPLIES,
      includeRetweets: env.TWITTER_INCLUDE_RETWEETS
    },
    update: {}
  });

  const tweets = await fetchLatestTweets({
    username: user.username,
    sinceId: user.lastTweetId,
    includeReplies: user.includeReplies,
    includeRetweets: user.includeRetweets
  });

  const saved = [];
  for (const tweet of tweets) {
    saved.push(
      await prisma.tweet.upsert({
        where: { tweetId: tweet.tweetId },
        create: {
          tweetId: tweet.tweetId,
          authorUsername: tweet.authorUsername,
          content: tweet.content,
          contentHash: sha256(`${tweet.authorUsername}:${tweet.content}`),
          sourceUrl: tweet.sourceUrl,
          tweetCreatedAt: tweet.tweetCreatedAt,
          watchUserId: user.id
        },
        update: {}
      })
    );
  }

  if (tweets.at(-1)) {
    await prisma.watchUser.update({
      where: { id: user.id },
      data: { lastTweetId: tweets.at(-1)?.tweetId }
    });
  }

  return NextResponse.json({ count: saved.length, tweets: saved });
}
