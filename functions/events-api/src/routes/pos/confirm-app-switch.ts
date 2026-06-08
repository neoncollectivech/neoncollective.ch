import { isSumUpAppSwitchReader } from "../../config/sumup-app-switch";
import { ordersService } from "../../services/orders.service";
import { runTransaction } from "../../services/transaction";
import {
  getSumUpPaymentStatusByForeignTransactionId,
  getSumUpPaymentStatusByTransactionCode,
} from "../../helpers/sumup";
import { fulfillPaidOrderFromSumup } from "../checkout/fulfill-paid-order";
import { handleFulfillmentResult } from "../checkout/handle-fulfillment-result";
import { getPosSaleStatus } from "./sale-status";

export type ConfirmPosAppSwitchInput = {
  smpStatus?: "success" | "failed" | "invalidstate";
  transactionCode?: string;
};

export async function confirmPosAppSwitchSale(
  orderId: string,
  eventId: string,
  input: ConfirmPosAppSwitchInput,
): Promise<
  | { ok: true; status: NonNullable<Awaited<ReturnType<typeof getPosSaleStatus>>> }
  | { ok: false; reason: "not_found" | "invalid_order" | "payment_failed" }
> {
  const order = await ordersService.get(orderId);
  if (!order || order.eventId !== eventId || order.paymentProvider !== "sumup") {
    return { ok: false, reason: "not_found" };
  }

  if (
    order.status !== "pending" ||
    !isSumUpAppSwitchReader(order.sumupReaderId)
  ) {
    return { ok: false, reason: "invalid_order" };
  }

  if (input.smpStatus === "failed" || input.smpStatus === "invalidstate") {
    await runTransaction((tx) => ordersService.failOrderInTx(tx, orderId));
    return { ok: false, reason: "payment_failed" };
  }

  let paymentStatus = await getSumUpPaymentStatusByForeignTransactionId(orderId);
  if (paymentStatus !== "successful" && input.transactionCode?.trim()) {
    paymentStatus = await getSumUpPaymentStatusByTransactionCode(
      input.transactionCode,
    );
  }

  if (paymentStatus === "failed") {
    await runTransaction((tx) => ordersService.failOrderInTx(tx, orderId));
    return { ok: false, reason: "payment_failed" };
  }

  if (paymentStatus === "successful") {
    const result = await fulfillPaidOrderFromSumup({
      orderId,
      source: "sumup_poll",
    });
    await handleFulfillmentResult(result);
  }

  const status = await getPosSaleStatus(orderId, eventId);
  if (!status) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, status };
}
