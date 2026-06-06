import type { ResolvedCheckoutPricing } from "../checkout/promotion-pricing";
import type { SelectedCheckoutTier } from "../checkout/resolve-selected-tiers";
import {
  isExclusiveSelection,
  splitOrdersByModeTx,
} from "../checkout/shared-pos-eligibility";
import { orderTiersService } from "../../services/order-tiers.service";
import { ordersService } from "../../services/orders.service";
import type { EntityTx } from "../../services/transaction";
import { supersedePendingPosOrderTx } from "./supersede-pending-pos-order";

type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.getInTx>>>;

export type ResolvePendingPosOrderResult =
  | { action: "create" }
  | {
      action: "resume";
      order: OrderRow;
      currency: string;
      eventTitle: string;
    };

async function pendingOrderMatchesCheckoutTx(
  tx: EntityTx,
  order: OrderRow,
  selectedTiers: SelectedCheckoutTier[],
  pricing: ResolvedCheckoutPricing,
): Promise<boolean> {
  if (order.amountCents !== pricing.amountCents) {
    return false;
  }
  return orderTiersService.pendingOrderTierIdsMatch(
    order.id,
    selectedTiers.map((tier) => tier.id),
    tx,
  );
}

export async function resolvePendingPosOrderInTx(
  tx: EntityTx,
  params: {
    eventId: string;
    personId: string;
    readerId: string;
    selectedTiers: SelectedCheckoutTier[];
    pricing: ResolvedCheckoutPricing;
    exclusiveTierIds: string[];
    eventTitle: string;
  },
): Promise<ResolvePendingPosOrderResult> {
  const personOrders = (
    await ordersService.listPendingOrPaidForPersonOnEventInTx(
      tx,
      params.eventId,
      params.personId,
    )
  ).filter((order) => order.paymentProvider === "sumup" && order.status === "pending");

  if (personOrders.length === 0) {
    return { action: "create" };
  }

  const splitOrders = await splitOrdersByModeTx(tx, personOrders, params.exclusiveTierIds);
  const selectedHasExclusive = isExclusiveSelection(params.selectedTiers);
  const pendingSameMode = selectedHasExclusive
    ? splitOrders.exclusiveOrders
    : splitOrders.addonOnlyOrders;

  for (const stale of pendingSameMode.slice(1)) {
    await supersedePendingPosOrderTx(tx, stale);
  }

  const existingOrder = pendingSameMode[0] ?? null;

  if (!existingOrder) {
    return { action: "create" };
  }

  const matches = await pendingOrderMatchesCheckoutTx(
    tx,
    existingOrder,
    params.selectedTiers,
    params.pricing,
  );

  if (!matches) {
    await supersedePendingPosOrderTx(tx, existingOrder);
    return { action: "create" };
  }

  const readerId = params.readerId.trim();
  if (existingOrder.sumupReaderId !== readerId) {
    if (existingOrder.sumupClientTransactionId) {
      await supersedePendingPosOrderTx(tx, existingOrder);
      return { action: "create" };
    }
    await ordersService.updateSumupReaderIdInTx(tx, existingOrder.id, readerId);
    existingOrder.sumupReaderId = readerId;
  }

  const currency = params.selectedTiers[0]!.currency.toLowerCase();

  return {
    action: "resume",
    order: existingOrder,
    currency,
    eventTitle: params.eventTitle,
  };
}
