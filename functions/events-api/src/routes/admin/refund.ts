import { isSumUpConfigured } from "../../config/sumup";
import { SumUpApiError, refundSumUpTransactionByClientTransactionId } from "../../helpers/sumup";
import { stripe } from "../../helpers/stripe";
import { ordersService } from "../../services/orders.service";
import { runTransaction } from "../../services/transaction";
import { applyOrderRefundEffectsInTx } from "../shared/apply-order-refund-effects";

export type RefundOrderFailureReason =
  | "order_not_found"
  | "order_not_refundable"
  | "stripe_failed"
  | "sumup_failed";

type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.get>>>;

export type RefundOrderDeps = {
  getOrder: (orderId: string) => Promise<OrderRow | null>;
  getOrderInTx: (tx: unknown, orderId: string) => Promise<OrderRow | null>;
  runOrderRefundTransaction: (
    fn: (tx: unknown) => Promise<void>,
  ) => Promise<void>;
  refundStripePaymentIntent: (paymentIntentId: string) => Promise<void>;
  refundSumUpClientTransaction: (clientTransactionId: string) => Promise<void>;
  applyRefundEffectsInTx: (tx: unknown, order: OrderRow) => Promise<void>;
  isSumUpConfigured: () => boolean;
};

const defaultDeps: RefundOrderDeps = {
  getOrder: (orderId) => ordersService.get(orderId),
  getOrderInTx: (tx, orderId) => ordersService.getInTx(tx as Parameters<typeof ordersService.getInTx>[0], orderId),
  runOrderRefundTransaction: (fn) => runTransaction((tx) => fn(tx)),
  refundStripePaymentIntent: async (paymentIntentId) => {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
  },
  refundSumUpClientTransaction: refundSumUpTransactionByClientTransactionId,
  applyRefundEffectsInTx: (tx, order) =>
    applyOrderRefundEffectsInTx(tx as Parameters<typeof applyOrderRefundEffectsInTx>[0], order),
  isSumUpConfigured,
};

export function createRefundOrder(deps: RefundOrderDeps = defaultDeps) {
  return async function refundOrder(params: { orderId: string }): Promise<
    | { ok: true; pending: true }
    | { ok: false; reason: RefundOrderFailureReason; error: string }
  > {
    const order = await deps.getOrder(params.orderId);
    if (!order) {
      return { ok: false, reason: "order_not_found", error: "Order not found." };
    }
    if (order.status === "refunded") {
      return { ok: true, pending: true };
    }
    if (order.status !== "paid") {
      return {
        ok: false,
        reason: "order_not_refundable",
        error: "Order cannot be refunded in its current state.",
      };
    }
    if (order.amountCents === 0) {
      return {
        ok: false,
        reason: "order_not_refundable",
        error: "Free orders cannot be refunded.",
      };
    }

    if (order.paymentProvider === "sumup") {
      return refundSumUpOrder(order, deps);
    }

    return refundStripeOrder(order, deps);
  };
}

export const refundOrder = createRefundOrder();

async function refundStripeOrder(
  order: OrderRow,
  deps: RefundOrderDeps,
): Promise<
  | { ok: true; pending: true }
  | { ok: false; reason: RefundOrderFailureReason; error: string }
> {
  if (!order.stripePaymentIntentId) {
    return {
      ok: false,
      reason: "order_not_refundable",
      error: "Order has no Stripe payment to refund.",
    };
  }
  try {
    await deps.refundStripePaymentIntent(order.stripePaymentIntentId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe refund failed";
    return { ok: false, reason: "stripe_failed", error: msg };
  }
  return { ok: true, pending: true };
}

async function refundSumUpOrder(
  order: OrderRow,
  deps: RefundOrderDeps,
): Promise<
  | { ok: true; pending: true }
  | { ok: false; reason: RefundOrderFailureReason; error: string }
> {
  if (!deps.isSumUpConfigured()) {
    return {
      ok: false,
      reason: "sumup_failed",
      error: "SumUp is not configured.",
    };
  }
  if (!order.sumupClientTransactionId) {
    return {
      ok: false,
      reason: "order_not_refundable",
      error: "Order has no SumUp payment to refund.",
    };
  }

  try {
    await deps.refundSumUpClientTransaction(order.sumupClientTransactionId);
  } catch (e) {
    if (!(e instanceof SumUpApiError && e.code === "conflict")) {
      const msg = e instanceof Error ? e.message : "SumUp refund failed";
      return { ok: false, reason: "sumup_failed", error: msg };
    }
  }

  try {
    await deps.runOrderRefundTransaction(async (tx) => {
      const current = await deps.getOrderInTx(tx, order.id);
      if (!current || current.status !== "paid") {
        return;
      }
      await deps.applyRefundEffectsInTx(tx, current);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refund processing failed";
    return { ok: false, reason: "sumup_failed", error: msg };
  }

  return { ok: true, pending: true };
}
