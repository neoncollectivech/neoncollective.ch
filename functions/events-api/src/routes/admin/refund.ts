import { stripe } from "../../helpers/stripe";
import { ordersService } from "../../services/orders.service";

export type RefundOrderFailureReason = "order_not_found" | "order_not_refundable" | "stripe_failed";

export async function refundOrder(params: { orderId: string }): Promise<
  | { ok: true; pending: true }
  | { ok: false; reason: RefundOrderFailureReason; error: string }
> {
  const order = await ordersService.get(params.orderId);
  if (!order) {
    return { ok: false, reason: "order_not_found", error: "Order not found." };
  }
  if (order.status !== "paid") {
    return {
      ok: false,
      reason: "order_not_refundable",
      error: "Order cannot be refunded in its current state.",
    };
  }
  if (order.amountCents === 0 || !order.stripePaymentIntentId) {
    return {
      ok: false,
      reason: "order_not_refundable",
      error: "Free orders cannot be refunded via Stripe.",
    };
  }
  try {
    await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe refund failed";
    return { ok: false, reason: "stripe_failed", error: msg };
  }
  return { ok: true, pending: true };
}
