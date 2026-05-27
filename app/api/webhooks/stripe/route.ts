import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  constructWebhookEvent,
  mapStripeStatusToTier,
  mapStripeSubscriptionStatus
} from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Stripe requires the raw body for webhook signature verification
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    logger.error({ err }, "Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Stripe webhook handler failed");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }
    default:
      logger.info({ eventType: event.type }, "Unhandled Stripe event");
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    logger.warn({ sessionId: session.id }, "Checkout session missing userId metadata");
    return;
  }

  const customerId = session.customer as string;

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId }
  });

  logger.info({ userId, customerId }, "Checkout completed, customer linked");
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const customerId = subscription.customer as string;

  // Find user by metadata userId or by stripeCustomerId
  const user = await prisma.user.findFirst({
    where: userId
      ? { id: userId }
      : { stripeCustomerId: customerId }
  });

  if (!user) {
    logger.warn({ customerId, userId }, "No user found for subscription update");
    return;
  }

  const priceId = subscription.items.data[0]?.price.id ?? "";
  const tier = mapStripeStatusToTier(priceId);
  const status = mapStripeSubscriptionStatus(subscription.status);
  // current_period_end may be on the billing cycle or items level depending on Stripe version
  const periodEndRaw =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (subscription as any).current_period_end ??
    subscription.items.data[0]?.current_period_end ??
    0;
  const currentPeriodEnd = new Date(periodEndRaw * 1000);
  const cancelAtPeriodEnd =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (subscription as any).cancel_at_period_end ?? false;

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: {
        userId: user.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: currentPeriodEnd,
        status,
        tier,
        cancelAtPeriodEnd
      },
      update: {
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: currentPeriodEnd,
        status,
        tier,
        cancelAtPeriodEnd
      }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: status === "ACTIVE" || status === "TRIALING" ? tier : "FREE"
      }
    })
  ]);

  logger.info({ userId: user.id, tier, status }, "Subscription updated");
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId }
  });

  if (!user) return;

  await prisma.$transaction([
    prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: "CANCELED" }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: "FREE" }
    })
  ]);

  logger.info({ userId: user.id }, "Subscription canceled, reverted to FREE");
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerId = (invoice as any).customer as string | undefined;
  if (!customerId) return;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId }
  });

  if (!user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string | undefined;

  await prisma.subscription.updateMany({
    where: {
      userId: user.id,
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {})
    },
    data: { status: "PAST_DUE" }
  });

  logger.warn({ userId: user.id }, "Payment failed, subscription marked past_due");
}
