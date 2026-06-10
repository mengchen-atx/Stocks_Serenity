/**
 * 一次性测试：把 Serenity 频道最新一条已推送的推文发布到小红书
 *
 * 运行方式：
 *   npx dotenv -e .env.local -- npx tsx scripts/xhs-test-post.ts
 */

import { prisma } from "@/lib/prisma";
import type { AiAnalysis } from "@/types";
import * as path from "path";
import * as dotenv from "dotenv";
import { screenshotCard, postToXhs, buildTitle, buildDescription } from "./xhs-daemon";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SERENITY_CHANNEL_ID = "cmpswr3350000ap123upcit90";

async function main() {
  const tweet = await prisma.tweet.findFirst({
    where: { pushed: true, xhsPosted: false, aiAnalysis: { not: "JsonNull" }, channelId: SERENITY_CHANNEL_ID },
    orderBy: { tweetCreatedAt: "desc" },
    include: { channel: { select: { name: true, slug: true } } },
  });

  if (!tweet) {
    console.log("没有符合条件的待测试推文");
    return;
  }

  console.log(`测试推文：${tweet.authorUsername} / ${tweet.id}`);

  const analysis = tweet.aiAnalysis as AiAnalysis | null;
  const imgPath = await screenshotCard(tweet.id);
  const title = buildTitle(tweet, analysis);
  const desc = buildDescription(tweet, analysis);

  await postToXhs(imgPath, title, desc);

  await prisma.tweet.update({ where: { id: tweet.id }, data: { xhsPosted: true } });
  console.log(`✅ xhsPosted = true (${tweet.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
