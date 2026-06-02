import { eventsService } from "../../services/events.service";
import {
  formatOrderTierNames,
  listRegisteredOrderTiersForOrders,
  type RegisteredOrderTierPayload,
} from "../shared/format-order-tiers";
import {
  findInviteLinkByRawToken,
  getHostInviteShareForViewer,
  inviteOnlyEventIdForLinkId,
  type InviteLinkConversion,
} from "../shared/invite-links-orchestration";
import { buildEventPayload } from "./payload";
import { resolveInviteOnlyEntitlement } from "../shared/invite-only-entitlement";
import { ordersService } from "../../services/orders.service";
import { orderTiersService } from "../../services/order-tiers.service";
import type { ResolvedParticipantSession } from "../registrations/session";
import {
  apiKeyGrantsEvent,
  type EventApiKeyAuth,
} from "../../auth/resolvers/event-api-key";

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

export async function findPaidRegistrationForViewer(
  eventId: string,
  personId: string,
): Promise<{ tierName: string; tiers: RegisteredOrderTierPayload[] } | null> {
  const paidOrderIds = await ordersService.listPaidOrderIdsForPersonOnEvent(
    eventId,
    personId,
  );
  if (paidOrderIds.length === 0) {
    return null;
  }
  const tiers = await listRegisteredOrderTiersForOrders(paidOrderIds);
  if (tiers.length === 0) {
    return null;
  }
  const tierName = await formatOrderTierNames(paidOrderIds[0]!);
  return tierName ? { tierName, tiers } : null;
}

async function resolveAvailableUpsellTiers(params: {
  eventId: string;
  personId: string;
  tiers:
    | {
        id: string;
        name: string;
        description: string;
        priceCents: number;
        currency: string;
        placesRemaining: number | null;
        active: boolean;
        sortOrder: number;
        selectionMode: "exclusive" | "addon";
      }[]
    | undefined;
}): Promise<
  | {
      id: string;
      name: string;
      description: string;
      priceCents: number;
      currency: string;
      placesRemaining: number | null;
      active: boolean;
      sortOrder: number;
      selectionMode: "exclusive" | "addon";
    }[]
  | undefined
> {
  if (!params.tiers || params.tiers.length === 0) {
    return undefined;
  }
  const addonCandidates = params.tiers.filter(
    (tier) =>
      tier.selectionMode === "addon" &&
      tier.active &&
      (tier.placesRemaining == null || tier.placesRemaining > 0),
  );
  if (addonCandidates.length === 0) {
    return [];
  }
  const orderIds = await ordersService.listIdsForPersonOnEventAndStatuses({
    eventId: params.eventId,
    personId: params.personId,
    statuses: ["pending", "paid"],
  });
  const purchasedTierIds = new Set(
    await orderTiersService.listTierIdsAmongOrderIds(orderIds),
  );
  return addonCandidates.filter((tier) => !purchasedTierIds.has(tier.id));
}

export type EventDetailForViewerBody = NonNullable<
  Awaited<ReturnType<typeof buildEventPayload>>
> & {
  access: "full" | "minimal";
  registrationConfirmed: boolean;
  registeredTierName?: string;
  registeredTiers?: RegisteredOrderTierPayload[];
  availableUpsellTiers?: NonNullable<
    NonNullable<Awaited<ReturnType<typeof buildEventPayload>>>["tiers"]
  >;
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
  apiKey?: EventApiKeyAuth | null;
}): Promise<
  | { ok: true; body: EventDetailForViewerBody }
  | { ok: false; reason: "event_not_found" }
> {
  const evRow = await eventsService.getPublishedBySlug(params.slug);
  if (!evRow) {
    return { ok: false, reason: "event_not_found" };
  }

  if (params.apiKey && !apiKeyGrantsEvent(params.apiKey, evRow.id)) {
    return { ok: false, reason: "event_not_found" };
  }

  let full = evRow.accessMode === "public";
  let inviteRemaining: number | undefined;
  let access: "full" | "minimal" = full ? "full" : "minimal";

  if (evRow.accessMode === "invite_only") {
    full = false;
    access = "minimal";
    const entitlement = await resolveInviteOnlyEntitlement({
      eventId: evRow.id,
      inviteToken: params.inviteToken,
      session: params.session,
      apiKey: params.apiKey,
    });
    if (entitlement.entitled) {
      full = true;
      access = "full";
      inviteRemaining = entitlement.inviteRemaining;
    }
  }

  const payload = await buildEventPayload(params.slug, full ? "full" : "minimal", {
    inviteRemaining,
  });
  if (!payload) {
    return { ok: false, reason: "event_not_found" };
  }

  let registrationConfirmed = false;
  let registeredTierName: string | undefined;
  let registeredTiers: RegisteredOrderTierPayload[] | undefined;
  let availableUpsellTiers:
    | NonNullable<
        NonNullable<Awaited<ReturnType<typeof buildEventPayload>>>["tiers"]
      >
    | undefined;
  let viewerGivenName: string | undefined;
  let hostInvite: EventDetailForViewerBody["hostInvite"];

  if (params.session?.personId) {
    const reg = await findPaidRegistrationForViewer(evRow.id, params.session.personId);
    if (reg) {
      registrationConfirmed = true;
      registeredTierName = reg.tierName;
      registeredTiers = reg.tiers;
      availableUpsellTiers = await resolveAvailableUpsellTiers({
        eventId: evRow.id,
        personId: params.session.personId,
        tiers: payload.tiers,
      });
    }
    if (registrationConfirmed && evRow.accessMode === "invite_only") {
      const share = await getHostInviteShareForViewer(evRow.id, params.session.personId);
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
    ...(registeredTiers?.length ? { registeredTiers } : {}),
    ...(availableUpsellTiers ? { availableUpsellTiers } : {}),
    ...(viewerGivenName ? { viewerGivenName } : {}),
    ...(hostInvite ? { hostInvite } : {}),
  };

  return { ok: true, body };
}
