import {
  normalizeEventImageUrls,
  type CatalogListParams,
  type CatalogListRow,
} from "../../services/events.service";
import { eventInviteesService } from "../../services/event-invitees.service";
import { eventsService } from "../../services/events.service";

export type { CatalogListParams, CatalogListRow };

export async function listPublishedCatalog(
  params: CatalogListParams | string | null,
): Promise<CatalogListRow[]> {
  const viewerPersonId =
    params == null || typeof params === "string" ? params : params.viewerPersonId;
  const inviteEventId =
    params != null && typeof params !== "string" ? params.inviteEventId : null;

  const publicRows = await eventsService.listPublishedPublicCatalogRows();
  const bySlug = new Map<string, CatalogListRow>();

  for (const r of publicRows) {
    bySlug.set(r.slug, {
      slug: r.slug,
      title: r.title,
      summary: r.summary ?? null,
      location: r.location ?? null,
      imageUrls: normalizeEventImageUrls(r.imageUrls),
      startsAt: r.startsAt,
      inviteOnly: false,
    });
  }

  if (viewerPersonId) {
    const eventIds = await eventInviteesService.listActiveEventIdsForPerson(viewerPersonId);
    const invitedEvents = await eventsService.getByIds(eventIds);
    for (const ev of invitedEvents) {
      if (ev.status !== "published" || ev.accessMode !== "invite_only") {
        continue;
      }
      bySlug.set(ev.slug, {
        slug: ev.slug,
        title: ev.title,
        summary: ev.summary ?? null,
        location: ev.location ?? null,
        imageUrls: normalizeEventImageUrls(ev.imageUrls),
        startsAt: ev.startsAt,
        inviteOnly: true,
      });
    }
  }

  if (inviteEventId) {
    const guestEv = await eventsService.getPublishedInviteOnlyById(inviteEventId);
    if (guestEv) {
      bySlug.set(guestEv.slug, {
        slug: guestEv.slug,
        title: guestEv.title,
        summary: guestEv.summary ?? null,
        location: guestEv.location ?? null,
        imageUrls: normalizeEventImageUrls(guestEv.imageUrls),
        startsAt: guestEv.startsAt,
        inviteOnly: true,
      });
    }
  }

  const combined = [...bySlug.values()];
  combined.sort((a, b) => {
    const ta = a.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const tb = b.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return ta - tb;
  });

  return combined;
}
