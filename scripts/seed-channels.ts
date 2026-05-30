/**
 * 初始化频道数据：
 * 1. 创建 serenity 和 leopold 两个频道
 * 2. 把现有的 WatchUser 和 Tweet 全部归入 serenity 频道
 * 3. 把所有已有付费 UID（WxPusherOtp 出现过的去重列表）授权访问 serenity 频道
 *
 * 运行：npx tsx scripts/seed-channels.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";

async function main() {
  // ── 1. 创建频道 ───────────────────────────────────────────────────────────
  const serenity = await prisma.channel.upsert({
    where: { slug: "serenity" },
    create: {
      slug: "serenity",
      name: "Serenity",
      description: "AI 基础设施供应链投资信号，聚焦半导体、数据中心、光互联",
      avatarUrl: "/serenity-portrait.jpg",
      wxpusherTopicId: process.env.WXPUSHER_TOPIC_ID ?? null,
    },
    update: {},
  });
  console.log("✅ serenity channel:", serenity.id);

  const leopold = await prisma.channel.upsert({
    where: { slug: "leopold" },
    create: {
      slug: "leopold",
      name: "Leopold",
      description: "Leopold Aschenbrenner 的 AI 宏观趋势与地缘政治分析",
      avatarUrl: null,
      wxpusherTopicId: null, // 后续配置 Leopold 专属 WxPusher 主题
    },
    update: {},
  });
  console.log("✅ leopold channel:", leopold.id);

  // ── 2. 把现有 WatchUser 归入 serenity 频道 ────────────────────────────────
  const updatedWatchUsers = await prisma.watchUser.updateMany({
    where: { channelId: null },
    data: { channelId: serenity.id },
  });
  console.log(`✅ 归入 serenity 的 WatchUser：${updatedWatchUsers.count} 个`);

  // ── 3. 把现有 Tweet 归入 serenity 频道 ───────────────────────────────────
  const updatedTweets = await prisma.tweet.updateMany({
    where: { channelId: null },
    data: { channelId: serenity.id },
  });
  console.log(`✅ 归入 serenity 的 Tweet：${updatedTweets.count} 条`);

  // ── 4. 把所有出现过的 UID 授权访问 serenity ───────────────────────────────
  // 从 WxPusherOtp 获取所有注册过的 UID（历史登录过的用户）
  const otpUids = await prisma.wxPusherOtp.findMany({
    select: { uid: true },
    distinct: ["uid"],
  });
  const uids = otpUids.map((o) => o.uid);
  console.log(`找到 ${uids.length} 个 UID，准备授权 serenity 访问权限...`);

  for (const uid of uids) {
    await prisma.userChannelAccess.upsert({
      where: { uid_channelId: { uid, channelId: serenity.id } },
      create: { uid, channelId: serenity.id },
      update: {},
    });
  }
  console.log(`✅ 已授权 ${uids.length} 个 UID 访问 serenity`);

  console.log("\n🎉 频道初始化完成！");
  console.log("Leopold 频道已创建，尚无订阅用户和 Twitter 账号，等待配置。");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
