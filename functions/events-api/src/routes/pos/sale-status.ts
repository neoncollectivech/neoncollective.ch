import { admissionsService } from "../../services/admissions.service";
import { ordersService } from "../../services/orders.service";
import { peopleService } from "../../services/people.service";
import { runTransaction } from "../../services/transaction";
import { getSumUpPaymentStatusByClientTransactionId } from "../../helpers/sumup";
import { formatOrderTierNames } from "../shared/format-order-tiers";
import { fulfillPaidOrderFromSumup } from "../checkout/fulfill-paid-order";

export type PosSaleStatus = {
  orderId: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paymentStatus: "pending" | "successful" | "failed" | "unknown";
  amountCents: number;
  guestName: string | null;
  tiers: string | null;
  signedCredential: string | null;
};

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
  } else if (order.status === "pending" && order.sumupClientTransactionId) {
    paymentStatus = await getSumUpPaymentStatusByClientTransactionId(
      order.sumupClientTransactionId,
    );
    if (paymentStatus === "successful") {
      await fulfillPaidOrderFromSumup({
        orderId: order.id,
        source: "sumup_poll",
      });
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

  let signedCredential: string | null = null;
  if (refreshedOrder.status === "paid") {
    signedCredential = await runTransaction(async (tx) => {
      const admission = await admissionsService.findCanonicalAdmissionForPersonOnEventInTx(
        tx,
        refreshedOrder.personId,
        eventId,
      );
      return admission?.signedCredential ?? null;
    });
  }

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
    signedCredential,
  };
}
