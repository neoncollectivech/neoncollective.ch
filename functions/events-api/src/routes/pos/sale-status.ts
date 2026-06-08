import { isSumUpAppSwitchReader } from "../../config/sumup-app-switch";
import { ordersService } from "../../services/orders.service";
import { peopleService } from "../../services/people.service";
import {
  getSumUpPaymentStatusByClientTransactionId,
  getSumUpPaymentStatusByForeignTransactionId,
} from "../../helpers/sumup";
import { formatOrderTierNames } from "../shared/format-order-tiers";
import { fulfillPaidOrderFromSumup } from "../checkout/fulfill-paid-order";
import { handleFulfillmentResult } from "../checkout/handle-fulfillment-result";

export type PosSaleStatus = {
  orderId: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paymentStatus: "pending" | "successful" | "failed" | "unknown";
  amountCents: number;
  guestName: string | null;
  tiers: string | null;
};

async function resolvePendingSumUpPaymentStatus(order: {
  id: string;
  sumupReaderId: string | null;
  sumupClientTransactionId: string | null;
}): Promise<"pending" | "successful" | "failed" | "unknown"> {
  if (isSumUpAppSwitchReader(order.sumupReaderId)) {
    return getSumUpPaymentStatusByForeignTransactionId(order.id);
  }

  if (!order.sumupClientTransactionId) {
    return "pending";
  }

  return getSumUpPaymentStatusByClientTransactionId(order.sumupClientTransactionId);
}

export async function getPosSaleStatus(
  orderId: string,
  eventId: string,
): Promise<PosSaleStatus | null> {
  const order = await ordersService.get(orderId);
  if (!order || order.eventId !== eventId || order.paymentProvider !== "sumup") {
    return null;
  }

  let paymentStatus: PosSaleStatus["paymentStatus"] = "pending";
  if (order.status === "paid") {
    paymentStatus = "successful";
  } else if (order.status === "failed") {
    paymentStatus = "failed";
  } else if (order.status === "pending") {
    paymentStatus = await resolvePendingSumUpPaymentStatus(order);
    if (paymentStatus === "successful") {
      const result = await fulfillPaidOrderFromSumup({
        orderId: order.id,
        source: "sumup_poll",
      });
      await handleFulfillmentResult(result);
    }
  }

  const refreshedOrder = (await ordersService.get(orderId)) ?? order;
  const person = await peopleService.get(refreshedOrder.personId);
  const guestName = person
    ? `${person.givenName} ${person.familyName}`.trim() || null
    : null;
  const tiers =
    refreshedOrder.status === "paid"
      ? (await formatOrderTierNames(orderId)) || null
      : null;

  const resolvedPaymentStatus =
    refreshedOrder.status === "paid"
      ? "successful"
      : refreshedOrder.status === "failed"
        ? "failed"
        : paymentStatus;

  return {
    orderId: refreshedOrder.id,
    status: refreshedOrder.status,
    paymentStatus: resolvedPaymentStatus,
    amountCents: refreshedOrder.amountCents,
    guestName,
    tiers,
  };
}
