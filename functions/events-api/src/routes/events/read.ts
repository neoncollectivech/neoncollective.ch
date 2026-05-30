import { eventsService } from "../../services/events.service";
import {
  formatOrderTierNames,
  listRegisteredOrderTiersForOrder,
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
import type { ResolvedParticipantSession } from "../registrations/session";

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
  const orderId = await ordersService.findLatestPaidOrderIdForPersonOnEvent(eventId, personId);
  if (!orderId) {
    return null;
  }
  const tiers = await listRegisteredOrderTiersForOrder(orderId);
  if (tiers.length === 0) {
    return null;
  }
  const tierName = await formatOrderTierNames(orderId);
  return tierName ? { tierName, tiers } : null;
}

export type EventDetailForViewerBody = NonNullable<
  Awaited<ReturnType<typeof buildEventPayload>>
> & {
  access: "full" | "minimal";
  registrationConfirmed: boolean;
  registeredTierName?: string;
  registeredTiers?: RegisteredOrderTierPayload[];
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
  let viewerGivenName: string | undefined;
  let hostInvite: EventDetailForViewerBody["hostInvite"];

  if (params.session?.personId) {
    const reg = await findPaidRegistrationForViewer(evRow.id, params.session.personId);
    if (reg) {
      registrationConfirmed = true;
      registeredTierName = reg.tierName;
      registeredTiers = reg.tiers;
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
    ...(viewerGivenName ? { viewerGivenName } : {}),
    ...(hostInvite ? { hostInvite } : {}),
  };

  return { ok: true, body };
}
