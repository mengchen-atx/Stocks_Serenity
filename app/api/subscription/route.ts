import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createOrRetrieveCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  TIER_PRICES
} from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ─── GET: fetch current subscription status ───────────────────────────────────

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const activeSubscription = user.subscriptions[0] ?? null;

  return NextResponse.json({
    tier: user.subscriptionTier,
    subscription: activeSubscription
      ? {
          id: activeSubscription.id,
          status: activeSubscription.status,
          tier: activeSubscription.tier,
          currentPeriodEnd: activeSubscription.stripeCurrentPeriodEnd,
          cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd
        }
      : null
  });
}

// ─── POST: create checkout or portal session ──────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { action: string; tier?: string };

  try {
    if (body.action === "portal") {
      return handlePortalRequest(session.user.id, session.user.stripeCustomerId);
    }

    if (body.action === "checkout") {
      return handleCheckoutRequest(
        session.user.id,
        session.user.email,
        session.user.name,
        body.tier
      );
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    logger.error({ err }, "Subscription API error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handlePortalRequest(userId: string, stripeCustomerId?: string | null) {
  const customerId =
    stripeCustomerId ??
    (await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true }
    }))?.stripeCustomerId;

  if (!customerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  const url = await createBillingPortalSession({
    customerId,
    returnUrl: `${env.APP_BASE_URL}/dashboard`
  });

  return NextResponse.json({ url });
}

async function handleCheckoutRequest(
  userId: string,
  email: string,
  name?: string | null,
  tier?: string
) {
  const priceId = tier ? TIER_PRICES[tier as keyof typeof TIER_PRICES] : null;
  if (!priceId) {
    return NextResponse.json({ error: "Invalid or missing tier" }, { status: 400 });
  }

  const customerId = await createOrRetrieveCustomer({ email, name, userId });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId }
  });

  const url = await createCheckoutSession({
    customerId,
    priceId,
    userId,
    successUrl: `${env.APP_BASE_URL}/dashboard?checkout=success`,
    cancelUrl: `${env.APP_BASE_URL}/pricing?checkout=canceled`
  });

  return NextResponse.json({ url });
}
