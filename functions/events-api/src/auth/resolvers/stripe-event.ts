import { createLogger } from "@neon/server-kit";
import type Stripe from "stripe";

import { getEventsApiEnv } from "../../config/runtime-env";
import { getStripe } from "../../helpers/stripe";

const log = createLogger("stripe-webhook-resolver");

export type ResolveStripeEventFailure = {
  ok: false;
  status: number;
  error: string;
};

export type ResolveStripeEventSuccess = {
  ok: true;
  event: Stripe.Event;
};

export async function resolveStripeEvent(
  rawBody: string,
  signature: string | undefined,
): Promise<ResolveStripeEventSuccess | ResolveStripeEventFailure> {
  const secret = getEventsApiEnv().stripeWebhookSecret;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_WEBHOOK_SECRET not configured." };
  }
  if (!signature) {
    return { ok: false, status: 400, error: "Missing Stripe-Signature header." };
  }
  try {
    const event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
    return { ok: true, event };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    log.warn({ msg }, "Webhook signature verification failed");
    return { ok: false, status: 400, error: msg };
  }
}
