import { orderTiersService } from "../services/order-tiers.service";
import { ordersService } from "../services/orders.service";
import type { EntityTx } from "../services/transaction";

/** Sellable headcount left for a tier. `tierQuota === null` means no tier cap (only event-level quota applies). */
export function computeTierPlacesRemaining(params: {
  tierQuota: number | null;
  sold: number;
  eventRemaining: number | null;
}): number | null {
  const tierCap =
    params.tierQuota == null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, params.tierQuota - params.sold);
  if (params.eventRemaining != null) {
    const n = Math.min(tierCap, params.eventRemaining);
    return Number.isFinite(n) ? n : params.eventRemaining;
  }
  if (tierCap === Number.POSITIVE_INFINITY) {
    return null;
  }
  return tierCap;
}

export type EventCapacitySnapshot = {
  used: number;
  remaining: number | null;
};

export type TierTx = EntityTx;

export async function getTierSoldQty(
  eventId: string,
  tierId: string,
  tx?: TierTx,
  excludeOrderId?: string,
): Promise<number> {
  let orderIds = await ordersService.listIdsByEventAndStatuses(
    eventId,
    ["pending", "paid"],
  );
  if (excludeOrderId) {
    orderIds = orderIds.filter((id) => id !== excludeOrderId);
  }
  return orderTiersService.countByTierAmongOrderIds(tierId, orderIds, tx);
}

export async function enrichTiersWithCapacityStats<
  T extends { id: string; quota: number | null },
>(
  eventId: string,
  eventQuota: number | null,
  tiers: T[],
): Promise<{
  tiers: (T & { sold: number; placesRemaining: number | null })[];
  capacity: EventCapacitySnapshot;
}> {
  const used = await ordersService.countPendingOrPaidForEvent(eventId);
  const remaining = eventQuota != null ? Math.max(0, eventQuota - used) : null;

  const enriched = await Promise.all(
    tiers.map(async (tier) => {
      const sold = await getTierSoldQty(eventId, tier.id);
      const placesRemaining = computeTierPlacesRemaining({
        tierQuota: tier.quota,
        sold,
        eventRemaining: remaining,
      });
      return { ...tier, sold, placesRemaining };
    }),
  );

  return { tiers: enriched, capacity: { used, remaining } };
}
