import { type EventAccess } from "../../services/events.service";
import { eventsService } from "../../services/events.service";
import { eventImagesService } from "../../services/event-images.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { enrichTiersWithCapacityStats } from "../../helpers/tier-capacity";

export type { EventAccess };

export async function buildEventPayload(
  slug: string,
  access: EventAccess,
  opts?: { inviteRemaining?: number },
) {
  const ev = await eventsService.getPublishedBySlug(slug);
  if (!ev) {
    return null;
  }
  if (access === "minimal") {
    return {
      slug: ev.slug,
      title: ev.title,
      summary: null,
      location: null,
      images: [],
      startsAt: null,
      accessMode: ev.accessMode,
      inviteOnly: ev.accessMode === "invite_only",
      inviteRemaining: opts?.inviteRemaining,
    };
  }
  const images = await eventImagesService.listPublicImagesByEventId(ev.id);
  const tiers = await eventTiersService.listActiveForEvent(ev.id);
  const { tiers: tiersWithSold } = await enrichTiersWithCapacityStats(
    ev.id,
    ev.eventQuota,
    tiers,
  );
  const tierPayload = tiersWithSold.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    priceCents: t.priceCents,
    currency: t.currency,
    placesRemaining: t.placesRemaining,
    active: t.active,
    sortOrder: t.sortOrder,
    selectionMode: t.selectionMode,
  }));
  return {
    slug: ev.slug,
    title: ev.title,
    summary: ev.summary ?? null,
    location: ev.location ?? null,
    images,
    startsAt: ev.startsAt?.toISOString() ?? null,
    accessMode: ev.accessMode,
    inviteOnly: ev.accessMode === "invite_only",
    inviteRemaining: opts?.inviteRemaining,
    tiers: tierPayload,
  };
}
