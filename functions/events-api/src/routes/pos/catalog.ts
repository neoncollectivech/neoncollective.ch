import { pruneLocalizedText } from "@neon/site-locales";
import { eventTiersService } from "../../services/event-tiers.service";
import { eventsService } from "../../services/events.service";
import { enrichTiersWithCapacityStats } from "../../helpers/tier-capacity";

export async function getPosCatalog(eventId: string) {
  const ev = await eventsService.get(eventId);
  if (!ev || ev.status !== "published") {
    return null;
  }

  const tiers = await eventTiersService.listActiveForEvent(ev.id);
  const { tiers: tiersWithSold } = await enrichTiersWithCapacityStats(
    ev.id,
    ev.eventQuota,
    tiers,
  );

  return {
    eventId: ev.id,
    title: ev.title,
    slug: ev.slug,
    tiers: tiersWithSold.map((t) => ({
      id: t.id,
      name: t.name,
      description: pruneLocalizedText(t.description),
      priceCents: t.priceCents,
      currency: t.currency,
      placesRemaining: t.placesRemaining,
      active: t.active,
      sortOrder: t.sortOrder,
      selectionMode: t.selectionMode,
    })),
  };
}
