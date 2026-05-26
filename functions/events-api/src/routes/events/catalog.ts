import {
  normalizeEventImageUrls,
  type CatalogListParams,
  type CatalogListRow,
} from "../../services/events.service";
import { eventInviteesService } from "../../services/event-invitees.service";
import { eventsService } from "../../services/events.service";
import { ordersService } from "../../services/orders.service";

export type { CatalogListParams, CatalogListRow };

function catalogRow(
  row: {
    slug: string;
    title: string;
    summary: string | null;
    location: string | null;
    imageUrls: unknown;
    startsAt: Date | null;
  },
  inviteOnly: boolean,
  registeredSlugs: Set<string>,
): CatalogListRow {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    location: row.location ?? null,
    imageUrls: normalizeEventImageUrls(row.imageUrls),
    startsAt: row.startsAt,
    inviteOnly,
    registrationConfirmed: registeredSlugs.has(row.slug),
  };
}

export async function listPublishedCatalog(
  params: CatalogListParams | string | null,
): Promise<CatalogListRow[]> {
  const viewerPersonId =
    params == null || typeof params === "string" ? params : params.viewerPersonId;
  const inviteEventId =
    params != null && typeof params !== "string" ? params.inviteEventId : null;

  const registeredSlugs = viewerPersonId
    ? await ordersService.listPaidEventSlugsForPerson(viewerPersonId)
    : new Set<string>();

  const publicRows = await eventsService.listPublishedPublicCatalogRows();
  const bySlug = new Map<string, CatalogListRow>();

  for (const r of publicRows) {
    bySlug.set(r.slug, catalogRow(r, false, registeredSlugs));
  }

  if (viewerPersonId) {
    const eventIds = await eventInviteesService.listActiveEventIdsForPerson(viewerPersonId);
    const invitedEvents = await eventsService.getByIds(eventIds);
    for (const ev of invitedEvents) {
      if (ev.status !== "published" || ev.accessMode !== "invite_only") {
        continue;
      }
      bySlug.set(ev.slug, catalogRow(ev, true, registeredSlugs));
    }
  }

  if (inviteEventId) {
    const guestEv = await eventsService.getPublishedInviteOnlyById(inviteEventId);
    if (guestEv) {
      bySlug.set(guestEv.slug, catalogRow(guestEv, true, registeredSlugs));
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
