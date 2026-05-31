/**
 * 禁用 Leopold 频道的 WxPusher 推送（测试阶段）
 * 清空 leopold 频道的 wxpusherTopicId，使 pipeline 不向订阅者推送
 *
 * 运行：npx tsx scripts/disable-leopold-push.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";

async function main() {
  const leopold = await prisma.channel.findUnique({ where: { slug: "leopold" } });
  if (!leopold) {
    console.error("❌ leopold 频道不存在");
    process.exit(1);
  }

  console.log(`当前 wxpusherTopicId: ${leopold.wxpusherTopicId ?? "(未设置)"}`);

  await prisma.channel.update({
    where: { slug: "leopold" },
    data: { wxpusherTopicId: null },
  });

  console.log("✅ 已清空 leopold 的 wxpusherTopicId，WxPusher 推送已禁用");
  console.log("   下次 pipeline 跑 leopold 推文时，将不会向任何订阅者推送");
  console.log("   如需恢复，运行：npx tsx scripts/setup-leopold.ts --topic-id <主题ID>");

  await prisma.$disconnect();
}

main().catch(console.error);
