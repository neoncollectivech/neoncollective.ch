import type { EntityTx } from "../../services/transaction";
import { ordersService } from "../../services/orders.service";
import { orderTiersService } from "../../services/order-tiers.service";
import {
  computeTierPlacesRemaining,
  getExclusiveTierLinesSoldQty,
  getTierSoldQty,
} from "../../helpers/tier-capacity";
import type { SelectedCheckoutTier } from "./resolve-selected-tiers";

type PosTx = EntityTx;
type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.getInTx>>>;

export function isExclusiveSelection(selectedTiers: SelectedCheckoutTier[]): boolean {
  return selectedTiers.some((tier) => tier.selectionMode === "exclusive");
}

export async function splitOrdersByModeTx(
  tx: PosTx,
  orders: OrderRow[],
  exclusiveTierIds: string[],
): Promise<{ exclusiveOrders: OrderRow[]; addonOnlyOrders: OrderRow[] }> {
  if (orders.length === 0 || exclusiveTierIds.length === 0) {
    return { exclusiveOrders: [], addonOnlyOrders: orders };
  }
  const orderIds = orders.map((order) => order.id);
  const lines = await orderTiersService.listForOrders(orderIds, tx);
  const hasExclusive = new Set<string>();
  for (const line of lines) {
    if (exclusiveTierIds.includes(line.eventTierId)) {
      hasExclusive.add(line.orderId);
    }
  }
  const exclusiveOrders: OrderRow[] = [];
  const addonOnlyOrders: OrderRow[] = [];
  for (const order of orders) {
    if (hasExclusive.has(order.id)) {
      exclusiveOrders.push(order);
      continue;
    }
    addonOnlyOrders.push(order);
  }
  return { exclusiveOrders, addonOnlyOrders };
}

export async function findAlreadyPurchasedAddonIdsTx(
  tx: PosTx,
  params: {
    eventId: string;
    personId: string;
    addonTierIds: string[];
    ignoreOrderId?: string;
  },
): Promise<string[]> {
  if (params.addonTierIds.length === 0) {
    return [];
  }
  const orderIds = await ordersService.listIdsForPersonOnEventAndStatusesInTx(tx, {
    eventId: params.eventId,
    personId: params.personId,
    statuses: ["pending", "paid"],
  });
  const filteredOrderIds = params.ignoreOrderId
    ? orderIds.filter((id) => id !== params.ignoreOrderId)
    : orderIds;
  const tierIds = await orderTiersService.listTierIdsAmongOrderIds(filteredOrderIds, tx);
  const owned = new Set(tierIds);
  return params.addonTierIds.filter((id) => owned.has(id));
}

export type PosSaleEligibilityFailureReason =
  | "already_registered"
  | "addon_only_requires_exclusive"
  | "addon_already_purchased"
  | "event_sold_out"
  | "tier_sold_out";

export async function assertPosSaleEligibilityInTx(
  tx: PosTx,
  params: {
    eventId: string;
    personId: string;
    selectedTiers: SelectedCheckoutTier[];
    eventQuota: number | null;
    exclusiveTierIds: string[];
    addonTierIds: string[];
  },
): Promise<{ ok: true } | { ok: false; reason: PosSaleEligibilityFailureReason; tierName?: string }> {
  const selectedHasExclusive = isExclusiveSelection(params.selectedTiers);
  const personOrders = await ordersService.listPendingOrPaidForPersonOnEventInTx(
    tx,
    params.eventId,
    params.personId,
  );
  const splitOrders = await splitOrdersByModeTx(tx, personOrders, params.exclusiveTierIds);
  const hasPaidExclusiveSeat = splitOrders.exclusiveOrders.some((order) => order.status === "paid");

  if (selectedHasExclusive && hasPaidExclusiveSeat) {
    return { ok: false, reason: "already_registered" };
  }

  if (!selectedHasExclusive && !hasPaidExclusiveSeat) {
    return { ok: false, reason: "addon_only_requires_exclusive" };
  }

  if (!selectedHasExclusive) {
    const alreadyPurchased = await findAlreadyPurchasedAddonIdsTx(tx, {
      eventId: params.eventId,
      personId: params.personId,
      addonTierIds: params.addonTierIds,
    });
    if (alreadyPurchased.length > 0) {
      return { ok: false, reason: "addon_already_purchased" };
    }
  }

  const eventRemainingForSelection = selectedHasExclusive
    ? params.eventQuota != null
      ? Math.max(
          0,
          params.eventQuota -
            (await getExclusiveTierLinesSoldQty(
              params.eventId,
              params.exclusiveTierIds,
              tx,
            )),
        )
      : null
    : null;

  if (selectedHasExclusive && eventRemainingForSelection != null && eventRemainingForSelection < 1) {
    return { ok: false, reason: "event_sold_out" };
  }

  for (const tier of params.selectedTiers) {
    const sold = await getTierSoldQty(params.eventId, tier.id, tx);
    const placesCap = computeTierPlacesRemaining({
      tierQuota: tier.quota,
      sold,
      eventRemaining:
        selectedHasExclusive && tier.selectionMode === "exclusive"
          ? eventRemainingForSelection
          : null,
    });
    const capForCompare = placesCap == null ? Number.POSITIVE_INFINITY : placesCap;
    if (1 > capForCompare) {
      return { ok: false, reason: "tier_sold_out", tierName: tier.name };
    }
  }

  return { ok: true };
}
