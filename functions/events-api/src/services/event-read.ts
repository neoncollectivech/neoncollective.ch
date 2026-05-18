import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../db/index.js";
import {
  eventInvitees,
  events,
  eventTiers,
  inviteLinks,
  inviteRedemptions,
  orders,
  orderTiers,
  people,
} from "../db/schema.js";
import { phoneToStoredDigits } from "../contact.js";
import { sha256Hex } from "../token.js";
import { ensureHostInviteLinkForPaidRosterPerson } from "./host-invite-link.js";

export type EventAccess = "full" | "minimal";

export class InviteMechanismDisabledError extends Error {
  constructor(
    message = "Invites are only available for invite-only events.",
  ) {
    super(message);
    this.name = "InviteMechanismDisabledError";
  }
}

/** Throws when the event exists but `access_mode` is not `invite_only`. */
export async function requireInviteOnlyEvent(eventId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ accessMode: events.accessMode })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!row) {
    return;
  }
  if (row.accessMode !== "invite_only") {
    throw new InviteMechanismDisabledError();
  }
}

export function normalizeEventImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

export async function inviteRemainingForLink(inviteLinkId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ maxRedemptions: inviteLinks.maxRedemptions })
    .from(inviteLinks)
    .where(eq(inviteLinks.id, inviteLinkId))
    .limit(1);
  if (!row) {
    return 0;
  }
  const used = await getInviteRedemptionQty(inviteLinkId);
  return Math.max(0, row.maxRedemptions - used);
}

export async function eventIdForInviteLinkId(inviteLinkId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ eventId: inviteLinks.eventId })
    .from(inviteLinks)
    .where(eq(inviteLinks.id, inviteLinkId))
    .limit(1);
  return row?.eventId ?? null;
}

/** Event id for catalog/session only when the linked event is invite-only. */
export async function inviteOnlyEventIdForInviteLinkId(
  inviteLinkId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ eventId: inviteLinks.eventId, accessMode: events.accessMode })
    .from(inviteLinks)
    .innerJoin(events, eq(events.id, inviteLinks.eventId))
    .where(eq(inviteLinks.id, inviteLinkId))
    .limit(1);
  if (!row || row.accessMode !== "invite_only") {
    return null;
  }
  return row.eventId;
}

export async function resolveInviteEventId(params: {
  inviteToken: string | null | undefined;
  sessionInviteLinkId: string | null | undefined;
}): Promise<string | null> {
  if (params.sessionInviteLinkId) {
    const fromSession = await inviteOnlyEventIdForInviteLinkId(
      params.sessionInviteLinkId,
    );
    if (fromSession) {
      return fromSession;
    }
  }
  const token = params.inviteToken?.trim();
  if (token) {
    const guest = await findInviteLinkByRawToken(token);
    if (guest && guest.event.accessMode === "invite_only") {
      return guest.event.id;
    }
  }
  return null;
}

export async function findInviteLinkByRawToken(rawToken: string) {
  const db = getDb();
  const hash = sha256Hex(rawToken);
  const [row] = await db
    .select({
      link: inviteLinks,
      inviter: people,
      event: events,
    })
    .from(inviteLinks)
    .leftJoin(people, eq(people.id, inviteLinks.inviterId))
    .innerJoin(events, eq(events.id, inviteLinks.eventId))
    .where(eq(inviteLinks.tokenHash, hash))
    .limit(1);
  return row ?? null;
}

export async function getInviteRedemptionQty(
  inviteLinkId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      qty: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.inviteLinkId, inviteLinkId),
        inArray(orders.status, ["pending", "paid"]),
      ),
    );
  return Number(row?.qty ?? 0);
}

/**
 * Sellable headcount left for a tier. `tierQuota === null` means no tier cap (only event-level quota applies).
 * Returns `null` when both tier and event are uncapped (unlimited).
 */
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

async function findRosterInviteesMatchingContact(
  eventId: string,
  email: string | null,
  phoneDigits: string | null,
): Promise<(typeof eventInvitees.$inferSelect)[]> {
  const db = getDb();
  const base = and(eq(eventInvitees.eventId, eventId), isNull(eventInvitees.revokedAt));
  const contactParts = [];
  if (email) {
    contactParts.push(eq(eventInvitees.email, email));
    contactParts.push(eq(people.email, email));
  }
  if (phoneDigits) {
    contactParts.push(eq(eventInvitees.phone, phoneDigits));
    contactParts.push(eq(people.phone, phoneDigits));
  }
  if (contactParts.length === 0) {
    return [];
  }
  const rows = await db
    .select({ inv: eventInvitees })
    .from(eventInvitees)
    .leftJoin(people, eq(people.id, eventInvitees.personId))
    .where(and(base, or(...contactParts)));
  const seen = new Set<string>();
  const out: (typeof eventInvitees.$inferSelect)[] = [];
  for (const row of rows) {
    if (!seen.has(row.inv.id)) {
      seen.add(row.inv.id);
      out.push(row.inv);
    }
  }
  return out;
}

export async function findRosterInvitee(eventId: string, email: string) {
  const em = normalizeEmail(email);
  const rows = await findRosterInviteesMatchingContact(eventId, em, null);
  if (rows.length === 0) {
    return null;
  }
  if (rows.length > 1) {
    return "ambiguous" as const;
  }
  return rows[0]!;
}

export async function findRosterInviteeByPhone(eventId: string, phoneE164: string) {
  const digits = phoneToStoredDigits(phoneE164);
  if (!digits) {
    return null;
  }
  const rows = await findRosterInviteesMatchingContact(eventId, null, digits);
  if (rows.length === 0) {
    return null;
  }
  if (rows.length > 1) {
    return "ambiguous" as const;
  }
  return rows[0]!;
}

export async function findRosterInviteeByContact(
  eventId: string,
  email: string,
  phoneDigits: string | null,
) {
  const em = email.trim() ? normalizeEmail(email) : null;
  const rows = await findRosterInviteesMatchingContact(eventId, em, phoneDigits);
  if (rows.length === 0) {
    return null;
  }
  if (rows.length > 1) {
    return "ambiguous" as const;
  }
  return rows[0]!;
}

/** Guest who completed a paid registration via a host’s invite link. */
export type InviteLinkConversion = {
  orderId: string;
  givenName: string;
  familyName: string;
  tierName: string;
  registeredAt: string;
};

/** Latest paid order for this person + event (for “already registered” on the event page). */
export type HostInviteShare = {
  givenName: string;
  inviteToken: string;
  inviteRemaining: number;
  conversions: InviteLinkConversion[];
};

export async function formatOrderTierNames(orderId: string): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({
      name: eventTiers.name,
      selectionMode: eventTiers.selectionMode,
      sortOrder: eventTiers.sortOrder,
    })
    .from(orderTiers)
    .innerJoin(eventTiers, eq(eventTiers.id, orderTiers.eventTierId))
    .where(eq(orderTiers.orderId, orderId))
    .orderBy(asc(eventTiers.sortOrder));

  if (rows.length === 0) {
    return "";
  }
  const exclusive = rows.filter((r) => r.selectionMode === "exclusive");
  const addons = rows.filter((r) => r.selectionMode === "addon");
  const parts = [
    ...exclusive.map((r) => r.name),
    ...addons.map((r) => r.name),
  ];
  return parts.join(" + ");
}

export async function listInviteLinkConversions(
  inviteLinkId: string,
): Promise<InviteLinkConversion[]> {
  const db = getDb();
  const rows = await db
    .select({
      orderId: orders.id,
      givenName: people.givenName,
      familyName: people.familyName,
      registeredAt: inviteRedemptions.createdAt,
    })
    .from(inviteRedemptions)
    .innerJoin(orders, eq(orders.id, inviteRedemptions.orderId))
    .innerJoin(people, eq(people.id, orders.personId))
    .where(
      and(
        eq(inviteRedemptions.inviteLinkId, inviteLinkId),
        eq(orders.status, "paid"),
      ),
    )
    .orderBy(desc(inviteRedemptions.createdAt));

  const out: InviteLinkConversion[] = [];
  for (const row of rows) {
    out.push({
      orderId: row.orderId,
      givenName: row.givenName.trim(),
      familyName: row.familyName.trim(),
      tierName: await formatOrderTierNames(row.orderId),
      registeredAt: row.registeredAt.toISOString(),
    });
  }
  return out;
}

/** Roster host with a paid registration — shareable guest link + remaining guest slots. */
export async function getHostInviteShareForViewer(
  eventId: string,
  personId: string,
): Promise<HostInviteShare | null> {
  await ensureHostInviteLinkForPaidRosterPerson(eventId, personId);

  const db = getDb();
  const [row] = await db
    .select({
      link: inviteLinks,
      host: people,
    })
    .from(inviteLinks)
    .innerJoin(people, eq(people.id, inviteLinks.inviterId))
    .where(and(eq(inviteLinks.eventId, eventId), eq(inviteLinks.inviterId, personId)))
    .limit(1);
  if (!row) {
    return null;
  }
  const used = await getInviteRedemptionQty(row.link.id);
  const conversions = await listInviteLinkConversions(row.link.id);
  return {
    givenName: row.host.givenName.trim(),
    inviteToken: row.link.token,
    inviteRemaining: Math.max(0, row.link.maxRedemptions - used),
    conversions,
  };
}

export async function findPaidRegistrationForViewer(
  eventId: string,
  personId: string,
): Promise<{ tierName: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ orderId: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.eventId, eventId),
        eq(orders.personId, personId),
        eq(orders.status, "paid"),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (!row) {
    return null;
  }
  const tierName = await formatOrderTierNames(row.orderId);
  return tierName ? { tierName } : null;
}

export async function findRosterInviteeByPersonId(eventId: string, personId: string) {
  const db = getDb();
  const base = and(eq(eventInvitees.eventId, eventId), isNull(eventInvitees.revokedAt));
  const rows = await db
    .select()
    .from(eventInvitees)
    .where(and(base, eq(eventInvitees.personId, personId)));
  if (rows.length === 0) {
    return null;
  }
  if (rows.length > 1) {
    return "ambiguous" as const;
  }
  return rows[0]!;
}

export async function getTierSoldQty(
  eventId: string,
  tierId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      qty: sql<number>`count(*)::int`,
    })
    .from(orderTiers)
    .innerJoin(orders, eq(orders.id, orderTiers.orderId))
    .where(
      and(
        eq(orders.eventId, eventId),
        eq(orderTiers.eventTierId, tierId),
        inArray(orders.status, ["pending", "paid"]),
      ),
    );
  return Number(row?.qty ?? 0);
}

export async function getTierSoldQtyTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  eventId: string,
  tierId: string,
): Promise<number> {
  const [row] = await tx
    .select({
      qty: sql<number>`count(*)::int`,
    })
    .from(orderTiers)
    .innerJoin(orders, eq(orders.id, orderTiers.orderId))
    .where(
      and(
        eq(orders.eventId, eventId),
        eq(orderTiers.eventTierId, tierId),
        inArray(orders.status, ["pending", "paid"]),
      ),
    );
  return Number(row?.qty ?? 0);
}

export async function getExclusiveTierIdForOrder(
  orderId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ eventTierId: orderTiers.eventTierId })
    .from(orderTiers)
    .innerJoin(eventTiers, eq(eventTiers.id, orderTiers.eventTierId))
    .where(and(eq(orderTiers.orderId, orderId), eq(eventTiers.selectionMode, "exclusive")))
    .limit(1);
  return row?.eventTierId ?? null;
}

export async function getExclusiveTierIdForOrderTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  orderId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ eventTierId: orderTiers.eventTierId })
    .from(orderTiers)
    .innerJoin(eventTiers, eq(eventTiers.id, orderTiers.eventTierId))
    .where(and(eq(orderTiers.orderId, orderId), eq(eventTiers.selectionMode, "exclusive")))
    .limit(1);
  return row?.eventTierId ?? null;
}

export async function getEventHeadcountUsed(eventId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      qty: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(eq(orders.eventId, eventId), inArray(orders.status, ["pending", "paid"])),
    );
  return Number(row?.qty ?? 0);
}

export type EventCapacitySnapshot = {
  used: number;
  remaining: number | null;
};

export async function enrichTiersWithCapacityStats<
  T extends { id: string; quota: number | null },
>(
  eventId: string,
  eventQuota: number | null,
  tiers: T[],
): Promise<{ tiers: (T & { sold: number; placesRemaining: number | null })[]; capacity: EventCapacitySnapshot }> {
  const used = await getEventHeadcountUsed(eventId);
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

export async function buildEventPayload(
  slug: string,
  access: EventAccess,
  opts?: { inviteRemaining?: number },
) {
  const db = getDb();
  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.status, "published")))
    .limit(1);
  if (!ev) {
    return null;
  }
  if (access === "minimal") {
    return {
      slug: ev.slug,
      title: ev.title,
      summary: ev.summary ?? null,
      location: ev.location ?? null,
      imageUrls: normalizeEventImageUrls(ev.imageUrls),
      startsAt: ev.startsAt?.toISOString() ?? null,
      accessMode: ev.accessMode,
      inviteOnly: ev.accessMode === "invite_only",
      inviteRemaining: opts?.inviteRemaining,
    };
  }
  const tiers = await db
    .select()
    .from(eventTiers)
    .where(and(eq(eventTiers.eventId, ev.id), eq(eventTiers.active, true)))
    .orderBy(asc(eventTiers.sortOrder));
  const headUsed = await getEventHeadcountUsed(ev.id);
  const eventRemaining =
    ev.eventQuota != null ? Math.max(0, ev.eventQuota - headUsed) : null;
  const tierPayload = [];
  for (const t of tiers) {
    const sold = await getTierSoldQty(ev.id, t.id);
    const placesRemaining = computeTierPlacesRemaining({
      tierQuota: t.quota,
      sold,
      eventRemaining,
    });
    tierPayload.push({
      id: t.id,
      name: t.name,
      description: t.description,
      priceCents: t.priceCents,
      currency: t.currency,
      placesRemaining,
      active: t.active,
      sortOrder: t.sortOrder,
      selectionMode: t.selectionMode,
    });
  }
  return {
    slug: ev.slug,
    title: ev.title,
    summary: ev.summary ?? null,
    location: ev.location ?? null,
    imageUrls: normalizeEventImageUrls(ev.imageUrls),
    startsAt: ev.startsAt?.toISOString() ?? null,
    accessMode: ev.accessMode,
    inviteOnly: ev.accessMode === "invite_only",
    inviteRemaining: opts?.inviteRemaining,
    tiers: tierPayload,
  };
}

export type CatalogListRow = {
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  imageUrls: string[];
  startsAt: Date | null;
  inviteOnly: boolean;
};

export type CatalogListParams = {
  viewerPersonId: string | null;
  /** Invite-only event visible via guest invite link on session or query. */
  inviteEventId: string | null;
};

/**
 * Published events for `GET /events`: all public events, plus invite-only events where
 * the viewer is on the roster or has a guest invite for that event.
 */
export async function listPublishedEventsCatalog(
  params: CatalogListParams | string | null,
): Promise<CatalogListRow[]> {
  const viewerPersonId =
    params == null || typeof params === "string" ? params : params.viewerPersonId;
  const inviteEventId =
    params != null && typeof params !== "string" ? params.inviteEventId : null;
  const db = getDb();
  const publicRows = await db
    .select({
      slug: events.slug,
      title: events.title,
      summary: events.summary,
      location: events.location,
      imageUrls: events.imageUrls,
      startsAt: events.startsAt,
    })
    .from(events)
    .where(and(eq(events.status, "published"), eq(events.accessMode, "public")));

  const invitedRows =
    viewerPersonId == null
      ? []
      : await db
          .select({
            slug: events.slug,
            title: events.title,
            summary: events.summary,
            location: events.location,
            imageUrls: events.imageUrls,
            startsAt: events.startsAt,
          })
          .from(events)
          .innerJoin(
            eventInvitees,
            and(
              eq(eventInvitees.eventId, events.id),
              eq(eventInvitees.personId, viewerPersonId),
              isNull(eventInvitees.revokedAt),
            ),
          )
          .where(
            and(eq(events.status, "published"), eq(events.accessMode, "invite_only")),
          );

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

  for (const r of invitedRows) {
    bySlug.set(r.slug, {
      slug: r.slug,
      title: r.title,
      summary: r.summary ?? null,
      location: r.location ?? null,
      imageUrls: normalizeEventImageUrls(r.imageUrls),
      startsAt: r.startsAt,
      inviteOnly: true,
    });
  }

  if (inviteEventId) {
    const [guestEv] = await db
      .select({
        slug: events.slug,
        title: events.title,
        summary: events.summary,
        location: events.location,
        imageUrls: events.imageUrls,
        startsAt: events.startsAt,
      })
      .from(events)
      .where(
        and(
          eq(events.id, inviteEventId),
          eq(events.status, "published"),
          eq(events.accessMode, "invite_only"),
        ),
      )
      .limit(1);
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
