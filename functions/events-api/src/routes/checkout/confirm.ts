import type Stripe from "stripe";

import { stripe } from "../../helpers/stripe";
import { ordersService } from "../../services/orders.service";
import { fulfillPaidOrder } from "./fulfill-paid-order";
import { sendPostCheckoutParticipantAccessEmail } from "../registrations/session";

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
  if (order.status === "paid" && order.checkoutFulfilledAt) {
    return { ok: true, alreadyPaid: true };
  }
  if (order.status !== "pending" && order.status !== "failed") {
    return { ok: false, reason: "checkout_not_confirmable" };
  }
  if (!order.stripePaymentIntentId) {
    return { ok: false, reason: "payment_not_started" };
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

  if (result.kind === "send_email") {
    try {
      await sendPostCheckoutParticipantAccessEmail(result.job);
    } catch {
      /* registration is confirmed; email failure is non-fatal for the client */
    }
    return { ok: true, alreadyPaid: false };
  }

  return { ok: true, alreadyPaid: true };
}
