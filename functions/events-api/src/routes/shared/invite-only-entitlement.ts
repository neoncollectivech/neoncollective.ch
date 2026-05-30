import { phoneToStoredDigits } from "../../helpers/contact";
import { eventInviteesService } from "../../services/event-invitees.service";
import { inviteLinksService } from "../../services/invite-links.service";
import { ordersService } from "../../services/orders.service";
import {
  findInviteLinkByRawToken,
  inviteRemainingForLink,
} from "./invite-links-orchestration";
import type { ResolvedParticipantSession } from "../registrations/session";
import { loadPublishedOrphanInviteeContact } from "../registrations/invitee-orchestration";

export type InviteOnlyEntitlementResult = {
  entitled: boolean;
  linkIdForRemaining: string | null;
  inviteRemaining?: number;
};

export async function resolveInviteOnlyEntitlement(params: {
  eventId: string;
  inviteToken: string | null | undefined;
  session: ResolvedParticipantSession | null;
}): Promise<InviteOnlyEntitlementResult> {
  const inviteQ = params.inviteToken?.trim();
  let entitled = false;
  let linkIdForRemaining: string | null = null;

  if (inviteQ) {
    const guest = await findInviteLinkByRawToken(inviteQ);
    if (guest && guest.event.id === params.eventId) {
      entitled = true;
      linkIdForRemaining = guest.link.id;
    }
  }

  if (!entitled && params.session?.inviteLinkId) {
    const linkEventId = await inviteLinksService.eventIdForLinkId(params.session.inviteLinkId);
    if (linkEventId === params.eventId) {
      entitled = true;
      linkIdForRemaining = params.session.inviteLinkId;
    }
  }

  if (!entitled && params.session?.eventInviteeId) {
    const pendingContact = await loadPublishedOrphanInviteeContact(params.session.eventInviteeId);
    if (pendingContact) {
      const eventInvitee = await eventInviteesService.findInviteeByContactWithPersonFallback(
        params.eventId,
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

  if (!entitled && params.session?.personId) {
    const eventInvitee = await eventInviteesService.findByPersonIdOnEvent(
      params.eventId,
      params.session.personId,
    );
    if (eventInvitee && eventInvitee !== "ambiguous") {
      entitled = true;
    }
    if (!entitled) {
      const orderId = await ordersService.findLatestPaidOrderIdForPersonOnEvent(
        params.eventId,
        params.session.personId,
      );
      if (orderId) {
        entitled = true;
      }
    }
  }

  let inviteRemaining: number | undefined;
  if (entitled && linkIdForRemaining) {
    inviteRemaining = await inviteRemainingForLink(linkIdForRemaining);
  }

  return { entitled, linkIdForRemaining, inviteRemaining };
}
