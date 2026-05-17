import { createLogger } from "@neon/server-kit";
import type Stripe from "stripe";

import { getDb } from "../db/index.js";
import { fulfillPaidOrderInTx } from "./fulfill-paid-order.js";
import { failOrderFromWebhook } from "./order-failure.js";
import { sendPostCheckoutParticipantAccessEmail } from "./registration-session.js";
import { stripe } from "../stripe.js";

const log = createLogger("stripe-webhook");

function orderIdFromPaymentIntent(pi: Stripe.PaymentIntent): string | null {
  const orderId = pi.metadata?.orderId;
  return typeof orderId === "string" && orderId.trim() ? orderId.trim() : null;
}

async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const orderId = orderIdFromPaymentIntent(pi);
  if (!orderId) {
    log.warn({ pi: pi.id }, "payment_intent.succeeded without orderId metadata");
    return { ok: true };
  }

  const db = getDb();
  let postCheckoutEmail: Awaited<ReturnType<typeof fulfillPaidOrderInTx>> = null;
  try {
    postCheckoutEmail = await db.transaction((tx) =>
      fulfillPaidOrderInTx(tx, {
        orderId,
        source: "webhook",
        stripeEventId: event.id,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    log.error({ err: e, orderId }, msg);
    return { ok: false, status: 500, error: msg };
  }

  if (postCheckoutEmail) {
    try {
      await sendPostCheckoutParticipantAccessEmail(postCheckoutEmail);
    } catch (e) {
      log.error({ err: e, orderId }, "Post-checkout access email failed");
    }
  }

  return { ok: true };
}

async function handlePaymentIntentFailedOrCanceled(
  event: Stripe.Event,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const orderId = orderIdFromPaymentIntent(pi);
  if (!orderId) {
    log.warn({ pi: pi.id, type: event.type }, "Payment intent webhook without orderId metadata");
    return { ok: true };
  }

  try {
    await failOrderFromWebhook({ orderId, stripeEventId: event.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    log.error({ err: e, orderId, type: event.type }, msg);
    return { ok: false, status: 500, error: msg };
  }

  return { ok: true };
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_WEBHOOK_SECRET not configured." };
  }
  if (!signature) {
    return { ok: false, status: 400, error: "Missing Stripe-Signature header." };
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    log.warn({ msg }, "Webhook signature verification failed");
    return { ok: false, status: 400, error: msg };
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      return handlePaymentIntentSucceeded(event);
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      return handlePaymentIntentFailedOrCanceled(event);
    default:
      return { ok: true };
  }
}
