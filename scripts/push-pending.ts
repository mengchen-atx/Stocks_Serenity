/**
 * 把数据库里所有 pushed=false 的推文推送到 WxPusher
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { handleTweet } from "@/lib/pipeline";

async function main() {
  const pending = await prisma.tweet.findMany({
    where: { pushed: false },
    orderBy: { tweetCreatedAt: "asc" }
  });

  console.log(`找到 ${pending.length} 条待推送推文\n`);

  for (const t of pending) {
    process.stdout.write(`推送 ${t.tweetId}...`);
    const r = await handleTweet({
      tweetId: t.tweetId,
      authorUsername: t.authorUsername,
      content: t.content,
      tweetCreatedAt: t.tweetCreatedAt,
      sourceUrl: t.sourceUrl ?? undefined
    });
    console.log(r.pushed ? " ✅ 已推送" : r.skipped ? " ⏭ 跳过" : " ❌ 失败");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
