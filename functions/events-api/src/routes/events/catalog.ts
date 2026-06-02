import {
  type CatalogListParams,
  type CatalogListRow,
} from "../../services/events.service";
import { eventInviteesService } from "../../services/event-invitees.service";
import {
  eventImagesService,
  type PublicEventImage,
} from "../../services/event-images.service";
import { eventsService } from "../../services/events.service";
import { ordersService } from "../../services/orders.service";

type CatalogSourceRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  startsAt: Date | null;
};

function catalogRow(
  row: CatalogSourceRow,
  inviteOnly: boolean,
  registeredSlugs: Set<string>,
  images: PublicEventImage[],
): CatalogListRow {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    location: row.location ?? null,
    images,
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
  const apiKeyEventId =
    params != null && typeof params !== "string" ? params.apiKeyEventId : undefined;
  const apiKeyIsGlobal =
    params != null && typeof params !== "string" ? params.apiKeyIsGlobal : false;

  const registeredSlugs = viewerPersonId
    ? await ordersService.listPaidEventSlugsForPerson(viewerPersonId)
    : new Set<string>();

  const publicRows = await eventsService.listPublishedPublicCatalogRows();
  const sourcesBySlug = new Map<string, CatalogSourceRow>();
  const inviteOnlyBySlug = new Map<string, boolean>();

  for (const r of publicRows) {
    sourcesBySlug.set(r.slug, r);
    inviteOnlyBySlug.set(r.slug, false);
  }

  if (viewerPersonId) {
    const eventIds = await eventInviteesService.listActiveEventIdsForPerson(viewerPersonId);
    const invitedEvents = await eventsService.getByIds(eventIds);
    for (const ev of invitedEvents) {
      if (ev.status !== "published" || ev.accessMode !== "invite_only") {
        continue;
      }
      sourcesBySlug.set(ev.slug, {
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        summary: ev.summary,
        location: ev.location,
        startsAt: ev.startsAt,
      });
      inviteOnlyBySlug.set(ev.slug, true);
    }
  }

  if (inviteEventId) {
    const guestEv = await eventsService.getPublishedInviteOnlyById(inviteEventId);
    if (guestEv) {
      sourcesBySlug.set(guestEv.slug, guestEv);
      inviteOnlyBySlug.set(guestEv.slug, true);
    }
  }

  if (apiKeyIsGlobal) {
    const inviteOnlyRows = await eventsService.listPublishedInviteOnlyCatalogRows();
    for (const ev of inviteOnlyRows) {
      sourcesBySlug.set(ev.slug, ev);
      inviteOnlyBySlug.set(ev.slug, true);
    }
  } else if (apiKeyEventId) {
    const guestEv = await eventsService.getPublishedInviteOnlyById(apiKeyEventId);
    if (guestEv) {
      sourcesBySlug.set(guestEv.slug, guestEv);
      inviteOnlyBySlug.set(guestEv.slug, true);
    }
  }

  const sources = [...sourcesBySlug.values()];
  const imagesByEventId = await eventImagesService.listPublicImagesByEventIds(
    sources.map((s) => s.id),
  );

  const combined = sources.map((row) =>
    catalogRow(
      row,
      inviteOnlyBySlug.get(row.slug) ?? false,
      registeredSlugs,
      imagesByEventId.get(row.id) ?? [],
    ),
  );

  combined.sort((a, b) => {
    const ta = a.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const tb = b.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return ta - tb;
  });

  return combined;
}
