/**
 * 检查用户的频道访问权限
 * 运行：npx tsx scripts/check-user-access.ts <UID>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";

const uid = process.argv[2] || "UID_JfTkKsh07ov6KpPKFVXP895RAECI";

async function main() {
  console.log(`\n🔍 检查 UID: ${uid}\n`);

  // 1. 检查 UserChannelAccess 表
  const accessRecords = await prisma.userChannelAccess.findMany({
    where: { uid },
    include: { channel: true },
  });

  console.log(`📊 UserChannelAccess 记录 (${accessRecords.length} 条):`);
  for (const r of accessRecords) {
    console.log(`  ✅ channelId=${r.channelId}, slug=${r.channel.slug}, name=${r.channel.name}, grantedAt=${r.grantedAt.toISOString()}`);
  }

  if (accessRecords.length === 0) {
    console.log("  ❌ 无任何记录 — grant script 可能没有运行到这个数据库");
  }

  // 2. 检查 WxPusherOtp 表
  const otpRecord = await prisma.wxPusherOtp.findFirst({ where: { uid } });
  console.log(`\n📊 WxPusherOtp 记录: ${otpRecord ? `存在 (used=${otpRecord.used})` : "❌ 不存在"}`);

  // 3. 检查所有频道
  const allChannels = await prisma.channel.findMany();
  console.log(`\n📊 所有频道 (${allChannels.length} 个):`);
  for (const c of allChannels) {
    const count = await prisma.userChannelAccess.count({ where: { channelId: c.id } });
    console.log(`  - ${c.slug} (${c.name}): ${count} 名订阅者`);
  }

  // 4. 列出所有有访问权限的 UID（前20个）
  const allAccess = await prisma.userChannelAccess.findMany({ take: 20, orderBy: { grantedAt: "asc" } });
  console.log(`\n📊 数据库中前 ${allAccess.length} 条访问记录:`);
  for (const a of allAccess) {
    console.log(`  uid=${a.uid}, channelId=${a.channelId}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
