import { eventsService } from "../../services/events.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { enrichTiersWithCapacityStats } from "../shared/tier-capacity";

export type EventAvailabilityCapacity = {
  quota: number | null;
  sold: number;
  remaining: number | null;
};

export type TierAvailabilityRow = EventAvailabilityCapacity & {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export type PublishedEventAvailability = {
  slug: string;
  event: EventAvailabilityCapacity;
  tiers: TierAvailabilityRow[];
};

export async function getPublishedEventAvailability(
  slug: string,
): Promise<PublishedEventAvailability | null> {
  const ev = await eventsService.getPublishedBySlug(slug);

  if (!ev) {
    return null;
  }

  const tiers = await eventTiersService.listActiveForEvent(ev.id);
  const { tiers: enriched, capacity } = await enrichTiersWithCapacityStats(
    ev.id,
    ev.eventQuota,
    tiers,
  );

  return {
    slug: ev.slug,
    event: {
      quota: ev.eventQuota,
      sold: capacity.used,
      remaining: capacity.remaining,
    },
    tiers: enriched.map((tier) => ({
      id: tier.id,
      name: tier.name,
      quota: tier.quota,
      sold: tier.sold,
      remaining: tier.placesRemaining,
      active: tier.active,
      sortOrder: tier.sortOrder,
    })),
  };
}
