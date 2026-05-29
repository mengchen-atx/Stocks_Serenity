/**
 * 手动给用户开通/续期 dashboard 访问权限
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/grant-access.ts <email> <天数>
 *
 * 示例：
 *   npx tsx --env-file=.env.local scripts/grant-access.ts user@example.com 30
 *   # 给 user@example.com 开通 30 天 PRO 权限
 */

import { PrismaClient, SubscriptionTier, SubscriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const days = parseInt(process.argv[3] ?? "30", 10);

  if (!email || isNaN(days) || days <= 0) {
    console.error("用法: npx tsx --env-file=.env.local scripts/grant-access.ts <email> <天数>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ 用户不存在: ${email}`);
    console.log("提示：用户需要先在网站上登录一次才会创建账号");
    process.exit(1);
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // 更新 user tier
  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionTier: SubscriptionTier.PRO }
  });

  // 创建或续期 Subscription 记录
  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { stripeCurrentPeriodEnd: "desc" }
  });

  if (existing) {
    // 在原有到期时间基础上续期（如果还未到期），或从今天开始算
    const base = existing.stripeCurrentPeriodEnd > new Date()
      ? existing.stripeCurrentPeriodEnd
      : new Date();
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        tier: SubscriptionTier.PRO,
        stripeCurrentPeriodEnd: newExpiry,
        cancelAtPeriodEnd: false
      }
    });
    console.log(`✅ 续期成功：${email}`);
    console.log(`   新到期时间：${newExpiry.toLocaleDateString("zh-CN")}`);
  } else {
    // 首次开通：创建新记录（stripeSubscriptionId 用伪 ID，非 Stripe 支付时用）
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: `manual_${user.id}_${Date.now()}`,
        stripePriceId: "manual",
        stripeCurrentPeriodEnd: expiresAt,
        status: SubscriptionStatus.ACTIVE,
        tier: SubscriptionTier.PRO
      }
    });
    console.log(`✅ 开通成功：${email}`);
    console.log(`   到期时间：${expiresAt.toLocaleDateString("zh-CN")}`);
  }

  // 显示当前状态
  console.log(`\n当前用户状态：`);
  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      subscriptions: {
        orderBy: { stripeCurrentPeriodEnd: "desc" },
        take: 1
      }
    }
  });
  console.log(`  邮箱：${updated?.email}`);
  console.log(`  Tier：${updated?.subscriptionTier}`);
  console.log(`  订阅到期：${updated?.subscriptions[0]?.stripeCurrentPeriodEnd?.toLocaleDateString("zh-CN") ?? "无"}`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
