import { createLogger } from "@neon/server-kit";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type Stripe from "stripe";

import { stripe } from "../helpers/stripe";
import { admissionsService } from "../services/admissions.service";
import { inviteRedemptionsService } from "../services/invite-redemptions.service";
import { ordersService } from "../services/orders.service";
import { stripeEventsProcessedService } from "../services/stripe-events-processed.service";
import {
  fulfillPaidOrder,
  type FulfillPaidOrderResult,
} from "./checkout/fulfill-paid-order";
import { sendPostCheckoutParticipantAccessEmail } from "./registrations/session";
import { runTransaction } from "../services/transaction";

const log = createLogger("stripe-webhook");

function orderIdFromPaymentIntent(pi: Stripe.PaymentIntent): string | null {
  const orderId = pi.metadata?.orderId;
  return typeof orderId === "string" && orderId.trim() ? orderId.trim() : null;
}

function isFulfillmentComplete(order: { status: string } | null): boolean {
  return order?.status === "paid";
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

  let result: FulfillPaidOrderResult;
  try {
    result = await fulfillPaidOrder({
      orderId,
      source: "webhook",
      stripeEventId: event.id,
      paymentIntentStatus: pi.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    log.error({ err: e, orderId }, msg);
    return { ok: false, status: 500, error: msg };
  }

  if (result.kind === "failed") {
    log.error({ orderId, reason: result.reason }, "Checkout fulfillment failed");
    return { ok: false, status: 500, error: result.reason };
  }

  if (result.kind === "send_email") {
    try {
      await sendPostCheckoutParticipantAccessEmail(result.job);
    } catch (e) {
      log.error({ err: e, orderId }, "Post-checkout access email failed");
    }
  }

  const order = await ordersService.get(orderId);
  if (!isFulfillmentComplete(order)) {
    log.error(
      { orderId, orderStatus: order?.status, resultKind: result.kind },
      "payment_intent.succeeded but order not paid after fulfillment",
    );
    return {
      ok: false,
      status: 500,
      error: "Fulfillment incomplete — order not paid.",
    };
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
    await runTransaction(async (tx) => {
      const claimed = await stripeEventsProcessedService.claimInTx(tx, event.id);
      if (!claimed) {
        log.info({ eventId: event.id }, "Duplicate webhook — skipping fail order");
        return;
      }
      const result = await ordersService.failOrderInTx(tx, orderId);
      if (result === "not_found") {
        log.warn({ orderId }, "Order not found for fail webhook");
        return;
      }
      if (result === "failed") {
        log.info({ orderId, eventId: event.id }, "Order marked failed");
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    log.error({ err: e, orderId, type: event.type }, msg);
    return { ok: false, status: 500, error: msg };
  }

  return { ok: true };
}

async function resolveOrderIdFromCharge(charge: Stripe.Charge): Promise<string | null> {
  const piRef = charge.payment_intent;
  const piId =
    typeof piRef === "string" ? piRef : piRef && typeof piRef === "object" ? piRef.id : null;
  if (!piId) {
    log.warn({ chargeId: charge.id }, "charge.refunded without payment_intent");
    return null;
  }

  if (typeof piRef === "object" && piRef !== null) {
    const fromMeta = orderIdFromPaymentIntent(piRef);
    if (fromMeta) {
      return fromMeta;
    }
  }

  const order = await ordersService.getByStripePaymentIntentId(piId);
  if (order) {
    return order.id;
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    return orderIdFromPaymentIntent(pi);
  } catch (e) {
    log.warn({ err: e, piId, chargeId: charge.id }, "Could not resolve order for refund webhook");
    return null;
  }
}

async function handleChargeRefunded(
  event: Stripe.Event,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const charge = event.data.object as Stripe.Charge;
  const orderId = await resolveOrderIdFromCharge(charge);
  if (!orderId) {
    return { ok: true };
  }

  try {
    await runTransaction(async (tx) => {
      const claimed = await stripeEventsProcessedService.claimInTx(tx, event.id);
      if (!claimed) {
        log.info({ eventId: event.id }, "Duplicate webhook — skipping refund");
        return;
      }

      const order = await ordersService.getInTx(tx, orderId);
      if (!order) {
        log.warn({ orderId }, "Order not found for refund webhook");
        return;
      }
      if (order.status === "refunded") {
        return;
      }
      if (order.status !== "paid") {
        log.warn(
          { orderId, status: order.status },
          "Skipping refund webhook — order not paid",
        );
        return;
      }

      await ordersService.markRefundedInTx(tx, order.id);
      await admissionsService.revokeForOrderInTx(tx, order.id);
      await inviteRedemptionsService.deleteForOrderInTx(tx, order.id);
      log.info({ orderId, eventId: event.id }, "Order refunded via webhook");
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    log.error({ err: e, orderId }, msg);
    return { ok: false, status: 500, error: msg };
  }

  return { ok: true };
}

async function handleStripeWebhook(
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
    case "charge.refunded":
      return handleChargeRefunded(event);
    default:
      return { ok: true };
  }
}

export function createWebhooksRouter(): Hono {
  const router = new Hono();

  router.post("/webhooks/stripe", async (c) => {
    const sig = c.req.header("stripe-signature");
    const raw = await c.req.text();
    const res = await handleStripeWebhook(raw, sig);
    if (!res.ok) {
      return c.text(res.error, res.status as ContentfulStatusCode);
    }
    return c.json({ received: true });
  });

  return router;
}
