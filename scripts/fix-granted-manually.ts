/**
 * 修正历史数据：将 webhook 自动授权的记录（expiresAt 非空 + uid 以 UID_ 开头）
 * 从 grantedManually=true 修正为 grantedManually=false，
 * 使 syncWxPusherSubscribers 能正确管理这些记录的到期/续费。
 *
 * 背景：webhook 以前错误调用了 grantChannelAccess，该函数始终设置 grantedManually=true，
 * 导致 A类（话题付费订阅）用户被误标为 B类（手动授权），到期后无法被自动清理。
 *
 * 安全性：只修改「有到期时间 + UID_ 开头」的记录，管理员（expiresAt=null）不受影响，
 * 真正的手动授权用户（通过 ops 后台设置的 B类用户）需要用户手动确认后再运行。
 *
 * 运行方式：
 *   DATABASE_URL=... npx ts-node -r tsconfig-paths/register scripts/fix-granted-manually.ts
 *
 * 建议先以 dryRun=true 预览，确认无误后再以 dryRun=false 执行。
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认 dry run，传 DRY_RUN=false 才真正写入

async function main() {
  console.log(`🔍 模式: ${DRY_RUN ? "DRY RUN（只预览，不修改）" : "⚠️  真正写入"}\n`);

  // 找出所有"有到期时间 + 被误标为 grantedManually=true"的 UID_ 用户记录
  const suspicious = await prisma.userChannelAccess.findMany({
    where: {
      grantedManually: true,
      expiresAt: { not: null },      // 有到期时间的才是 webhook/sync 系统记录
      uid: { startsWith: "UID_" },   // 只处理 WxPusher UID（排除 PWD_ 密码用户）
    },
    include: { channel: { select: { slug: true, name: true } } },
    orderBy: { grantedAt: "asc" },
  });

  if (suspicious.length === 0) {
    console.log("✅ 没有需要修正的记录，数据干净。");
    return;
  }

  console.log(`找到 ${suspicious.length} 条可能被误标的记录：\n`);
  for (const r of suspicious) {
    const expired = r.expiresAt && r.expiresAt < new Date() ? "【已过期】" : "";
    console.log(
      `  uid=${r.uid}  channel=${r.channel.slug}(${r.channel.name})  expiresAt=${r.expiresAt?.toISOString()}  ${expired}`
    );
  }

  if (DRY_RUN) {
    console.log("\n👆 以上记录将被修正（grantedManually: true → false）");
    console.log("确认无误后，执行：DRY_RUN=false npx ts-node -r tsconfig-paths/register scripts/fix-granted-manually.ts");
    return;
  }

  // 真正修正
  const uids = suspicious.map((r) => r.uid);
  const result = await prisma.userChannelAccess.updateMany({
    where: {
      grantedManually: true,
      expiresAt: { not: null },
      uid: { startsWith: "UID_" },
    },
    data: { grantedManually: false },
  });

  console.log(`\n✅ 已修正 ${result.count} 条记录（grantedManually: true → false）`);
  console.log("这些记录现在可以被 syncWxPusherSubscribers 正常管理（到期自动清理）。");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
