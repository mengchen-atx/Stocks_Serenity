/**
 * Dashboard 访问控制
 *
 * 判断逻辑（任一满足即有权限）：
 * 1. 用户的 subscriptionTier 不是 FREE（管理员手动升级，或 Stripe 自动变更）
 * 2. 用户有至少一条 status=ACTIVE/TRIALING 且未到期的 Subscription 记录
 *
 * 管理员可通过脚本手动给用户开通权限，见 scripts/grant-access.ts
 */

import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";

export type AccessResult =
  | { ok: true; tier: SubscriptionTier; expiresAt: Date | null }
  | { ok: false; reason: "not_logged_in" | "no_subscription" | "expired" };

/**
 * 检查指定用户是否有 dashboard 访问权限
 */
export async function checkDashboardAccess(userId: string): Promise<AccessResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true }
  });

  if (!user) return { ok: false, reason: "no_subscription" };

  // ── 方案1：tier 已被设置为付费档（管理员手动或 Stripe webhook 变更）────────
  if (user.subscriptionTier !== SubscriptionTier.FREE) {
    // 再确认有没有有效的 Subscription 记录（含到期时间）
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
        stripeCurrentPeriodEnd: { gt: new Date() }
      },
      orderBy: { stripeCurrentPeriodEnd: "desc" }
    });

    if (sub) {
      return { ok: true, tier: user.subscriptionTier, expiresAt: sub.stripeCurrentPeriodEnd };
    }

    // tier 不是 FREE 但没有有效记录 → 可能是手动设置的管理员账号，允许访问
    // 如果你不想允许这种情况，把下面这行去掉即可
    return { ok: true, tier: user.subscriptionTier, expiresAt: null };
  }

  // ── 方案2：tier = FREE，但有有效的 Subscription 记录（极少见，兜底）────────
  const activeSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      stripeCurrentPeriodEnd: { gt: new Date() }
    },
    orderBy: { stripeCurrentPeriodEnd: "desc" }
  });

  if (activeSub) {
    return { ok: true, tier: activeSub.tier, expiresAt: activeSub.stripeCurrentPeriodEnd };
  }

  // 查一下是否有已过期的记录（用来给出更准确的错误原因）
  const expiredSub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { stripeCurrentPeriodEnd: "desc" }
  });

  return { ok: false, reason: expiredSub ? "expired" : "no_subscription" };
}
