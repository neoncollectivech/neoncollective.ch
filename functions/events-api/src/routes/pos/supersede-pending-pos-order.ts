import { terminateSumUpReaderCheckout } from "../../helpers/sumup";
import { ordersService } from "../../services/orders.service";
import type { EntityTx } from "../../services/transaction";

type PendingPosOrder = NonNullable<Awaited<ReturnType<typeof ordersService.getInTx>>>;

export async function supersedePendingPosOrderTx(
  tx: EntityTx,
  order: PendingPosOrder,
): Promise<void> {
  if (order.sumupReaderId) {
    try {
      await terminateSumUpReaderCheckout(order.sumupReaderId);
    } catch {
      /* reader may already be idle */
    }
  }
  await ordersService.failOrderInTx(tx, order.id);
}
