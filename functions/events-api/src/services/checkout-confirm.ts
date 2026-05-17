import { eq } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { orders } from "../db/schema.js";
import { stripe } from "../stripe.js";
import { fulfillPaidOrder } from "./fulfill-paid-order.js";
import {
  resolveParticipantSessionFromCookie,
  sendPostCheckoutParticipantAccessEmail,
} from "./registration-session.js";

export async function confirmEventCheckout(params: {
  orderId: string;
  cookieHeader: string | undefined;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const session = await resolveParticipantSessionFromCookie(params.cookieHeader);
  if (!session?.personId) {
    return { ok: false, status: 401, error: "Sign in to confirm your registration." };
  }

  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);
  if (!order) {
    return { ok: false, status: 404, error: "Order not found." };
  }
  if (order.personId !== session.personId) {
    return { ok: false, status: 403, error: "This order does not belong to your session." };
  }
  if (order.status === "paid") {
    return { ok: true };
  }
  if (order.status !== "pending") {
    return { ok: false, status: 409, error: "This checkout can no longer be confirmed." };
  }
  if (!order.stripePaymentIntentId) {
    return { ok: false, status: 400, error: "Payment has not been started for this order." };
  }

  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
  } catch {
    return { ok: false, status: 502, error: "Could not verify payment with Stripe." };
  }

  if (pi.status !== "succeeded") {
    return {
      ok: false,
      status: 409,
      error: "Payment is not complete yet. Wait a moment and try again.",
    };
  }
  if (pi.metadata?.orderId !== order.id) {
    return { ok: false, status: 500, error: "Payment does not match this order." };
  }

  const emailJob = await fulfillPaidOrder({ orderId: order.id, source: "client" });
  if (emailJob) {
    try {
      await sendPostCheckoutParticipantAccessEmail(emailJob);
    } catch {
      /* registration is confirmed; email failure is non-fatal for the client */
    }
  }
  return { ok: true };
}
