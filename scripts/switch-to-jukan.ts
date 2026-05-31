/**
 * 把 leopold 频道切换为 Jukan (@jukan05)
 * 1. 删除 leopold 的推文和 stock mentions
 * 2. 更新 WatchUser：leopoldasch → jukan05
 * 3. 更新频道：slug/name leopold → jukan
 *
 * 运行：set -a && source .env.local && set +a && npx tsx scripts/switch-to-jukan.ts
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔄 切换频道：Leopold → Jukan\n");

  // 1. 查找 leopold 频道
  const channel = await prisma.channel.findUnique({ where: { slug: "leopold" } });
  if (!channel) {
    console.error("❌ leopold 频道不存在");
    process.exit(1);
  }
  console.log(`频道: ${channel.name} (${channel.id})`);

  // 2. 删除该频道下的所有推文（含 stock mentions，cascade 会自动删除）
  const tweets = await prisma.tweet.findMany({
    where: { channelId: channel.id },
    select: { id: true, tweetId: true },
  });
  if (tweets.length > 0) {
    console.log(`\n🗑️  删除 ${tweets.length} 条 Leopold 推文及相关 mentions...`);
    await prisma.stockMention.deleteMany({
      where: { tweetId: { in: tweets.map((t) => t.id) } },
    });
    await prisma.tweet.deleteMany({ where: { channelId: channel.id } });
    console.log("   ✅ 已清除");
  } else {
    console.log("\n   (无推文需要清除)");
  }

  // 3. 更新 WatchUser
  const watchUser = await prisma.watchUser.findFirst({
    where: { channelId: channel.id },
  });
  if (watchUser) {
    await prisma.watchUser.update({
      where: { id: watchUser.id },
      data: {
        username: "jukan05",
        displayName: "Jukan",
        lastTweetId: null, // 重置，从头爬
      },
    });
    console.log(`\n✅ WatchUser 已更新：@${watchUser.username} → @jukan05`);
  } else {
    // 如果没有则新建
    await prisma.watchUser.create({
      data: {
        username: "jukan05",
        displayName: "Jukan",
        enabled: true,
        includeReplies: false,
        includeRetweets: false,
        channelId: channel.id,
      },
    });
    console.log("\n✅ 新建 WatchUser: @jukan05");
  }

  // 4. 更新频道名称和 slug
  await prisma.channel.update({
    where: { id: channel.id },
    data: {
      slug: "jukan",
      name: "Jukan",
      description: "Jukan (@jukan05) 美股分析",
    },
  });
  console.log("✅ 频道已更新：leopold → jukan");

  console.log("\n🎉 完成！下一步运行 backfill-jukan.ts 来爬取历史推文");
  await prisma.$disconnect();
}

main().catch(console.error);
