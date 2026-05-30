/**
 * 配置 Leopold 频道：
 * 1. 把 @leopoldasch 加为 WatchUser，绑定到 leopold 频道
 * 2. 输出频道 ID，后续填入 WxPusher 主题 ID
 *
 * 运行：npx tsx scripts/setup-leopold.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";

async function main() {
  const leopold = await prisma.channel.findUnique({ where: { slug: "leopold" } });
  if (!leopold) { console.error("leopold channel not found, run seed-channels.ts first"); process.exit(1); }

  const watchUser = await prisma.watchUser.upsert({
    where: { username: "leopoldasch" },
    create: {
      username: "leopoldasch",
      displayName: "Leopold Aschenbrenner",
      enabled: true,
      includeReplies: false,
      includeRetweets: false,
      channelId: leopold.id,
    },
    update: {
      channelId: leopold.id,
      includeReplies: false,
      includeRetweets: false,
      enabled: true,
    },
  });

  console.log("✅ WatchUser 已创建：", watchUser.username);
  console.log("✅ 绑定频道：leopold (", leopold.id, ")");
  console.log("\n下一步：");
  console.log("1. 去 WxPusher 后台新建一个主题（给 Leopold 订阅者用）");
  console.log("2. 拿到主题 ID 后运行：");
  console.log("   npx tsx scripts/setup-leopold.ts --topic-id <主题ID>");

  const topicIdArg = process.argv.find((a) => a.startsWith("--topic-id="))?.split("=")[1]
    ?? (process.argv.indexOf("--topic-id") !== -1 ? process.argv[process.argv.indexOf("--topic-id") + 1] : null);

  if (topicIdArg) {
    await prisma.channel.update({
      where: { slug: "leopold" },
      data: { wxpusherTopicId: topicIdArg },
    });
    console.log(`\n✅ WxPusher 主题 ID 已更新：${topicIdArg}`);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
