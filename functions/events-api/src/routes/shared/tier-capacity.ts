import { computeTierPlacesRemaining } from "../../helpers/tier-capacity";
import { orderTiersService } from "../../services/order-tiers.service";
import { ordersService } from "../../services/orders.service";
import type { EntityTx } from "../../services/transaction";

export type EventCapacitySnapshot = {
  used: number;
  remaining: number | null;
};

export type TierTx = EntityTx;

export async function getTierSoldQty(
  eventId: string,
  tierId: string,
  tx?: TierTx,
): Promise<number> {
  const orderIds = await ordersService.listIdsByEventAndStatuses(
    eventId,
    ["pending", "paid"],
  );
  return orderTiersService.countByTierAmongOrderIds(tierId, orderIds, tx);
}

export async function enrichTiersWithCapacityStats<T extends { id: string; quota: number | null }>(
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
