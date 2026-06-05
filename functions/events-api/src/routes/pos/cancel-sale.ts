import { ordersService } from "../../services/orders.service";
import { runTransaction } from "../../services/transaction";
import { terminateSumUpReaderCheckout } from "../../helpers/sumup";

export async function cancelPosSale(
  orderId: string,
  eventId: string,
): Promise<"cancelled" | "not_found" | "not_cancellable"> {
  const order = await ordersService.get(orderId);
  if (!order || order.eventId !== eventId || order.paymentProvider !== "sumup") {
    return "not_found";
  }
  if (order.status !== "pending") {
    return "not_cancellable";
  }

  if (order.sumupReaderId) {
    try {
      await terminateSumUpReaderCheckout(order.sumupReaderId);
    } catch {
      /* termination is best-effort */
    }
  }

  const result = await runTransaction((tx) => ordersService.failOrderInTx(tx, orderId));
  if (result === "not_found") {
    return "not_found";
  }
  if (result === "already_terminal") {
    return "not_cancellable";
  }
  return "cancelled";
}
