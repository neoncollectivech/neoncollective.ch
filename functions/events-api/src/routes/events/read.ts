import { phoneToStoredDigits } from "../../helpers/contact";
import { formatOrderTierNames } from "../shared/format-order-tiers";
import { eventInviteesService } from "../../services/event-invitees.service";
import { peopleService } from "../../services/people.service";
import {
  eventsService,
  InviteMechanismDisabledError,
  normalizeEventImageUrls,
} from "../../services/events.service";
import {
  findInviteLinkByRawToken,
  getHostInviteShareForViewer,
  inviteOnlyEventIdForLinkId,
  inviteRemainingForLink,
  listInviteLinkConversions,
  type InviteLinkConversion,
} from "../shared/invite-links-orchestration";
import { inviteLinksService } from "../../services/invite-links.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { orderTiersService } from "../../services/order-tiers.service";
import { ordersService } from "../../services/orders.service";
import {
  getTierSoldQty as getTierSoldQtyInner,
  enrichTiersWithCapacityStats,
  getTierSoldQty,
} from "../shared/tier-capacity";
import type { EntityTx } from "../../services/transaction";
import type { ResolvedParticipantSession } from "../registrations/session";

export { computeTierPlacesRemaining } from "../../helpers/tier-capacity";
export { InviteMechanismDisabledError };
export async function requireInviteOnlyEvent(eventId: string): Promise<void> {
  return eventsService.requireInviteOnly(eventId);
}
export type { CatalogListParams, EventAccess } from "../../services/events.service";
export type { InviteLinkConversion } from "../shared/invite-links-orchestration";
export type { EventCapacitySnapshot } from "../shared/tier-capacity";
export { normalizeEventImageUrls };

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

function inviteeLookupResult<T>(rows: T[]): T | null | "ambiguous" {
  if (rows.length === 0) {
    return null;
  }
  if (rows.length > 1) {
    return "ambiguous";
  }
  return rows[0]!;
}

export { inviteRemainingForLink };

export async function eventIdForInviteLinkId(inviteLinkId: string): Promise<string | null> {
  return inviteLinksService.eventIdForLinkId(inviteLinkId);
}

export async function resolveInviteEventId(params: {
  inviteToken: string | null | undefined;
  sessionInviteLinkId: string | null | undefined;
}): Promise<string | null> {
  if (params.sessionInviteLinkId) {
    const fromSession = await inviteOnlyEventIdForLinkId(params.sessionInviteLinkId);
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

export async function getInviteRedemptionQty(inviteLinkId: string): Promise<number> {
  return ordersService.countPendingOrPaidForInviteLink(inviteLinkId);
}

export async function findEventInvitee(eventId: string, email: string) {
  const rows = await eventInviteesService.findActiveInviteesByContactOnEvent(eventId, {
    email: normalizeEmail(email),
  });
  return inviteeLookupResult(rows);
}

export async function findEventInviteeByPhone(eventId: string, phoneE164: string) {
  const rows = await eventInviteesService.findActiveInviteesByContactOnEvent(eventId, {
    email: null,
    phoneE164,
  });
  return inviteeLookupResult(rows);
}

export async function findEventInviteeByContact(
  eventId: string,
  email: string,
  phoneDigits: string | null,
) {
  const em = email.trim() ? normalizeEmail(email) : null;
  const rows = await eventInviteesService.findActiveInviteesByContactOnEvent(eventId, {
    email: em,
    phoneDigits,
    phoneE164: phoneDigits ? `+${phoneDigits}` : null,
  });
  const direct = inviteeLookupResult(rows);
  if (direct) {
    return direct;
  }
  let personId: string | undefined;
  if (em) {
    personId =
      (await peopleService.findPersonIdByEmail(em)) ??
      (await eventInviteesService.findLinkedPersonIdByEmail(em));
  } else if (phoneDigits) {
    personId =
      (await peopleService.findPersonIdByPhoneE164(`+${phoneDigits}`)) ??
      (await eventInviteesService.findLinkedPersonIdByPhoneE164(`+${phoneDigits}`));
  }
  if (!personId) {
    return null;
  }
  return findEventInviteeByPersonId(eventId, personId);
}

export { formatOrderTierNames } from "../shared/format-order-tiers";

export { listInviteLinkConversions };

export type HostInviteShare = {
  givenName: string;
  inviteToken: string;
  inviteRemaining: number;
  conversions: InviteLinkConversion[];
};

export { getHostInviteShareForViewer };

export async function findPaidRegistrationForViewer(
  eventId: string,
  personId: string,
): Promise<{ tierName: string } | null> {
  const orderId = await ordersService.findLatestPaidOrderIdForPersonOnEvent(eventId, personId);
  if (!orderId) {
    return null;
  }
  const tierName = await formatOrderTierNames(orderId);
  return tierName ? { tierName } : null;
}

export async function findEventInviteeByPersonId(eventId: string, personId: string) {
  return eventInviteesService.findByPersonIdOnEvent(eventId, personId);
}

export { getTierSoldQty };

export async function getTierSoldQtyTx(
  tx: EntityTx,
  eventId: string,
  tierId: string,
): Promise<number> {
  return getTierSoldQtyInner(eventId, tierId, tx);
}

export async function getExclusiveTierIdForOrder(orderId: string): Promise<string | null> {
  const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId);
  return eventTiersService.findExclusiveTierIdAmong(tierIds);
}

export async function getExclusiveTierIdForOrderTx(
  tx: EntityTx,
  orderId: string,
): Promise<string | null> {
  const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId, tx);
  return eventTiersService.findExclusiveTierIdAmong(tierIds, tx);
}

export { enrichTiersWithCapacityStats };

import { buildEventPayload } from "./payload";
import { listPublishedCatalog as listPublishedEventsCatalog } from "./catalog";
import {
  findPublishedOrphanInviteeId,
  loadPublishedOrphanInviteeContact,
} from "../registrations/invitee-orchestration";

export { buildEventPayload, listPublishedEventsCatalog };
export { findPublishedOrphanInviteeId, loadPublishedOrphanInviteeContact };

export type EventDetailForViewerBody = NonNullable<
  Awaited<ReturnType<typeof import("./payload").buildEventPayload>>
> & {
  access: "full" | "minimal";
  registrationConfirmed: boolean;
  registeredTierName?: string;
  viewerGivenName?: string;
  hostInvite?: {
    token: string;
    remaining: number;
    conversions: InviteLinkConversion[];
  };
};

export async function getPublishedEventDetailForViewer(params: {
  slug: string;
  inviteToken: string | null | undefined;
  session: ResolvedParticipantSession | null;
}): Promise<
  | { ok: true; body: EventDetailForViewerBody }
  | { ok: false; reason: "event_not_found" }
> {
  const evRow = await eventsService.getPublishedBySlug(params.slug);
  if (!evRow) {
    return { ok: false, reason: "event_not_found" };
  }

  const session = params.session;
  const inviteQ = params.inviteToken;

  let full = evRow.accessMode === "public";
  let inviteRemaining: number | undefined;
  let access: "full" | "minimal" = full ? "full" : "minimal";

  if (evRow.accessMode === "invite_only") {
    full = false;
    access = "minimal";
    let entitled = false;
    let linkIdForRemaining: string | null = null;
    if (inviteQ) {
      const guest = await findInviteLinkByRawToken(inviteQ);
      if (guest && guest.event.id === evRow.id) {
        entitled = true;
        linkIdForRemaining = guest.link.id;
      }
    }
    if (!entitled && session?.inviteLinkId) {
      const linkEventId = await eventIdForInviteLinkId(session.inviteLinkId);
      if (linkEventId === evRow.id) {
        entitled = true;
        linkIdForRemaining = session.inviteLinkId;
      }
    }
    if (!entitled && session?.eventInviteeId) {
      const pendingContact = await loadPublishedOrphanInviteeContact(session.eventInviteeId);
      if (pendingContact) {
        const eventInvitee = await findEventInviteeByContact(
          evRow.id,
          pendingContact.email ?? "",
          pendingContact.phoneE164
            ? phoneToStoredDigits(pendingContact.phoneE164)
            : null,
        );
        if (eventInvitee && eventInvitee !== "ambiguous") {
          entitled = true;
        }
      }
    }
    if (!entitled && session?.personId) {
      const eventInvitee = await findEventInviteeByPersonId(evRow.id, session.personId);
      if (eventInvitee && eventInvitee !== "ambiguous") {
        entitled = true;
      }
      if (!entitled) {
        const reg = await findPaidRegistrationForViewer(evRow.id, session.personId);
        if (reg) {
          entitled = true;
        }
      }
    }
    if (entitled) {
      full = true;
      access = "full";
      if (linkIdForRemaining) {
        inviteRemaining = await inviteRemainingForLink(linkIdForRemaining);
      }
    }
  } else {
    access = full ? "full" : "minimal";
  }

  const payload = await buildEventPayload(params.slug, full ? "full" : "minimal", {
    inviteRemaining,
  });
  if (!payload) {
    return { ok: false, reason: "event_not_found" };
  }

  let registrationConfirmed = false;
  let registeredTierName: string | undefined;
  let viewerGivenName: string | undefined;
  let hostInvite: EventDetailForViewerBody["hostInvite"];

  if (session?.personId) {
    const reg = await findPaidRegistrationForViewer(evRow.id, session.personId);
    if (reg) {
      registrationConfirmed = true;
      registeredTierName = reg.tierName;
    }
    if (registrationConfirmed && evRow.accessMode === "invite_only") {
      const share = await getHostInviteShareForViewer(evRow.id, session.personId);
      if (share) {
        viewerGivenName = share.givenName;
        hostInvite = {
          token: share.inviteToken,
          remaining: share.inviteRemaining,
          conversions: share.conversions,
        };
      }
    }
  }

  const body: EventDetailForViewerBody = {
    ...payload,
    access,
    registrationConfirmed,
    ...(registeredTierName ? { registeredTierName } : {}),
    ...(viewerGivenName ? { viewerGivenName } : {}),
    ...(hostInvite ? { hostInvite } : {}),
  };

  return { ok: true, body };
}
