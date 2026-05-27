import Stripe from "stripe";
import { env } from "@/lib/env";

// ─── Client ──────────────────────────────────────────────────────────────────

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required");
  stripeInstance ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia"
  });
  return stripeInstance;
}

// ─── Tier → Price mapping ────────────────────────────────────────────────────

export const TIER_PRICES = {
  BASIC: env.STRIPE_PRICE_BASIC ?? "",
  PRO: env.STRIPE_PRICE_PRO ?? "",
  PREMIUM: env.STRIPE_PRICE_PREMIUM ?? ""
} as const;

export const TIER_AMOUNTS_CNY = {
  FREE: 0,
  BASIC: 39,
  PRO: 99,
  PREMIUM: 199
} as const;

export const TIER_FEATURES = {
  FREE: ["实时 Dashboard", "历史 50 条推文", "股票信号预览"],
  BASIC: ["实时 Dashboard", "不限历史记录", "Email 推送通知", "基础 AI 解读"],
  PRO: [
    "Full Dashboard",
    "Email + Telegram 推送",
    "深度 AI 分析",
    "股票 Watchlist",
    "每日情报邮件"
  ],
  PREMIUM: [
    "全功能无限制",
    "微信 + Telegram + Email 推送",
    "最高优先级推送（<30 秒）",
    "多 KOL 监控",
    "自定义 Watchlist",
    "专属社群"
  ]
} as const;

// ─── Customer Management ─────────────────────────────────────────────────────

export async function createOrRetrieveCustomer(params: {
  email: string;
  name?: string | null;
  userId: string;
}): Promise<string> {
  const stripe = getStripe();
  const existing = await stripe.customers.search({
    query: `email:"${params.email}"`
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name ?? undefined,
    metadata: { userId: params.userId }
  });

  return customer.id;
}

// ─── Checkout Session ────────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      metadata: { userId: params.userId }
    },
    metadata: { userId: params.userId }
  });

  if (!session.url) throw new Error("Checkout session URL is missing");
  return session.url;
}

// ─── Portal Session ──────────────────────────────────────────────────────────

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl
  });
  return session.url;
}

// ─── Webhook Helpers ─────────────────────────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is required");
  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
}

export function mapStripeStatusToTier(
  priceId: string
): "BASIC" | "PRO" | "PREMIUM" | "FREE" {
  if (priceId === TIER_PRICES.BASIC) return "BASIC";
  if (priceId === TIER_PRICES.PRO) return "PRO";
  if (priceId === TIER_PRICES.PREMIUM) return "PREMIUM";
  return "FREE";
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" | "UNPAID" | "INCOMPLETE" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "trialing":
      return "TRIALING";
    case "unpaid":
      return "UNPAID";
    default:
      return "INCOMPLETE";
  }
}
