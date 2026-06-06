import type Stripe from "stripe";

import { stripe } from "../../helpers/stripe";
import { ordersService } from "../../services/orders.service";
import { fulfillPaidOrder } from "./fulfill-paid-order";
import { handleFulfillmentResult } from "./handle-fulfillment-result";

export type ConfirmPaidCheckoutFailureReason =
  | "order_not_found"
  | "order_forbidden"
  | "checkout_not_confirmable"
  | "payment_not_started"
  | "stripe_unavailable"
  | "payment_incomplete"
  | "payment_mismatch"
  | "checkout_fulfillment_failed";

export async function confirmPaidCheckout(params: {
  orderId: string;
  personId: string;
}): Promise<
  | { ok: true; alreadyPaid: boolean }
  | { ok: false; reason: ConfirmPaidCheckoutFailureReason }
> {
  const order = await ordersService.get(params.orderId);
  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }
  if (order.personId !== params.personId) {
    return { ok: false, reason: "order_forbidden" };
  }

  if (order.status === "paid") {
    let paymentIntentStatus: Stripe.PaymentIntent.Status | undefined;
    if (order.stripePaymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
        paymentIntentStatus = pi.status;
      } catch {
        return { ok: false, reason: "stripe_unavailable" };
      }
    }

    const result = await fulfillPaidOrder({
      orderId: order.id,
      source: "client",
      paymentIntentStatus,
    });
    if (result.kind === "failed") {
      return { ok: false, reason: "checkout_fulfillment_failed" };
    }
    await handleFulfillmentResult(result);
    return { ok: true, alreadyPaid: true };
  }

  if (order.status !== "pending" && order.status !== "failed") {
    return { ok: false, reason: "checkout_not_confirmable" };
  }
  if (!order.stripePaymentIntentId) {
    if (order.amountCents !== 0) {
      return { ok: false, reason: "payment_not_started" };
    }
    const freeResult = await fulfillPaidOrder({
      orderId: order.id,
      source: "client",
    });
    if (freeResult.kind === "failed") {
      return { ok: false, reason: "checkout_fulfillment_failed" };
    }
    await handleFulfillmentResult(freeResult);
    return { ok: true, alreadyPaid: freeResult.kind === "noop" };
  }

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
  } catch {
    return { ok: false, reason: "stripe_unavailable" };
  }

  if (pi.status !== "succeeded") {
    return { ok: false, reason: "payment_incomplete" };
  }
  if (pi.metadata?.orderId !== order.id) {
    return { ok: false, reason: "payment_mismatch" };
  }

  const result = await fulfillPaidOrder({
    orderId: order.id,
    source: "client",
    paymentIntentStatus: pi.status,
  });

  if (result.kind === "failed") {
    return { ok: false, reason: "checkout_fulfillment_failed" };
  }

  await handleFulfillmentResult(result);
  return { ok: true, alreadyPaid: result.kind === "noop" };
}
