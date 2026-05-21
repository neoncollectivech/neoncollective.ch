import type { EntityTx } from "../../services/transaction";
import { formatOrderTierNames } from "./format-order-tiers";
import { sha256Hex } from "../../helpers/token";
import { eventInviteesService } from "../../services/event-invitees.service";
import { eventsService } from "../../services/events.service";
import { inviteLinksService } from "../../services/invite-links.service";
import { inviteRedemptionsService } from "../../services/invite-redemptions.service";
import { ordersService } from "../../services/orders.service";
import { peopleService } from "../../services/people.service";

export type InviteLinkLookupTx = EntityTx;

type InviteLinkRow = NonNullable<
  Awaited<ReturnType<typeof inviteLinksService.findByTokenHash>>
>;
type EventRow = NonNullable<Awaited<ReturnType<typeof eventsService.get>>>;
type PersonRow = NonNullable<Awaited<ReturnType<typeof peopleService.get>>>;

export type InviteLinkByTokenRow = {
  link: InviteLinkRow;
  event: EventRow;
  inviter: PersonRow | null;
};

export type InviteLinkConversion = {
  orderId: string;
  givenName: string;
  familyName: string;
  tierName: string;
  registeredAt: string;
};

export class InviteLinkUpdateError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "not_host_link" | "below_used",
  ) {
    super(message);
    this.name = "InviteLinkUpdateError";
  }
}

export class InviteLinkDeleteError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "in_use",
  ) {
    super(message);
    this.name = "InviteLinkDeleteError";
  }
}

export async function findInviteLinkByRawToken(
  rawToken: string,
  options?: { tx?: InviteLinkLookupTx; includeInviter?: boolean },
): Promise<InviteLinkByTokenRow | null> {
  const hash = sha256Hex(rawToken);
  const includeInviter = options?.includeInviter !== false;
  const link = options?.tx
    ? await inviteLinksService.findByTokenHashInTx(options.tx, hash)
    : await inviteLinksService.findByTokenHash(hash);
  if (!link) {
    return null;
  }
  const event = options?.tx
    ? await eventsService.getInTx(options.tx, link.eventId)
    : await eventsService.get(link.eventId);
  if (!event) {
    return null;
  }
  let inviter: PersonRow | null = null;
  if (includeInviter && link.inviterId) {
    inviter = options?.tx
      ? (await peopleService.getInTx(options.tx, link.inviterId)) ?? null
      : (await peopleService.get(link.inviterId)) ?? null;
  }
  return { link, event, inviter };
}

export async function inviteOnlyEventIdForLinkId(inviteLinkId: string): Promise<string | null> {
  const eventId = await inviteLinksService.eventIdForLinkId(inviteLinkId);
  if (!eventId) {
    return null;
  }
  const ev = await eventsService.get(eventId);
  if (!ev || ev.accessMode !== "invite_only") {
    return null;
  }
  return eventId;
}

export async function inviteRemainingForLink(inviteLinkId: string): Promise<number> {
  const max = await inviteLinksService.getMaxRedemptions(inviteLinkId);
  if (max == null) {
    return 0;
  }
  const used = await ordersService.countPendingOrPaidForInviteLink(inviteLinkId);
  return Math.max(0, max - used);
}

export async function listInviteLinkConversions(
  inviteLinkId: string,
): Promise<InviteLinkConversion[]> {
  const redemptions = await inviteRedemptionsService.listRowsForInviteLink(inviteLinkId);
  if (redemptions.length === 0) {
    return [];
  }
  const orderRows = await ordersService.getByIds(redemptions.map((r) => r.orderId));
  const orderById = new Map(orderRows.map((o) => [o.id, o]));
  const peopleById = await peopleService.getByIdsMap(
    orderRows.filter((o) => o.status === "paid").map((o) => o.personId),
  );

  const out: InviteLinkConversion[] = [];
  for (const redemption of redemptions) {
    const order = orderById.get(redemption.orderId);
    if (!order || order.status !== "paid") {
      continue;
    }
    const person = peopleById.get(order.personId);
    if (!person) {
      continue;
    }
    out.push({
      orderId: order.id,
      givenName: person.givenName.trim(),
      familyName: person.familyName.trim(),
      tierName: await formatOrderTierNames(order.id),
      registeredAt: redemption.createdAt.toISOString(),
    });
  }
  return out;
}

export async function getHostInviteShareForViewer(
  eventId: string,
  personId: string,
): Promise<{
  givenName: string;
  inviteToken: string;
  inviteRemaining: number;
  conversions: InviteLinkConversion[];
} | null> {
  const hostRow = await eventInviteesService.findFirstDegreeHostOnEvent(eventId, personId);
  if (!hostRow) {
    return null;
  }

  const hostLink = await inviteLinksService.findHostLinkByEventAndPerson(eventId, personId);
  if (!hostLink) {
    return null;
  }
  const host = await peopleService.get(personId);
  if (!host) {
    return null;
  }
  const used = await ordersService.countPendingOrPaidForInviteLink(hostLink.id);
  const conversions = await listInviteLinkConversions(hostLink.id);
  return {
    givenName: host.givenName.trim(),
    inviteToken: hostLink.token,
    inviteRemaining: Math.max(0, hostLink.maxRedemptions - used),
    conversions,
  };
}

export async function ensureHostInviteLinkForPersonInTx(
  tx: InviteLinkLookupTx,
  eventId: string,
  personId: string,
): Promise<string | null> {
  const ev = await eventsService.getInTx(tx, eventId);
  if (!ev || ev.accessMode !== "invite_only") {
    return null;
  }

  const eventInvitee = await eventInviteesService.findFirstDegreeHostOnEventInTx(
    tx,
    eventId,
    personId,
  );
  if (!eventInvitee) {
    return null;
  }

  const existing = await inviteLinksService.findHostLinkByEventAndPersonInTx(
    tx,
    eventId,
    personId,
  );
  if (existing) {
    return existing.token;
  }

  const { raw, tokenHash } = inviteLinksService.mintRawToken();
  await inviteLinksService.insertHostLinkInTx(tx, {
    eventId,
    personId,
    maxRedemptions: ev.defaultInviteLinkMaxRedemptions,
    token: raw,
    tokenHash,
  });
  return raw;
}

export async function mintOrRotateHostInviteLinkForPersonInTx(
  tx: InviteLinkLookupTx,
  eventId: string,
  personId: string,
  maxRedemptions?: number | null,
): Promise<string | null> {
  const ev = await eventsService.getInTx(tx, eventId);
  if (!ev || ev.accessMode !== "invite_only") {
    return null;
  }

  const eventInvitee = await eventInviteesService.findFirstDegreeHostOnEventInTx(
    tx,
    eventId,
    personId,
  );
  if (!eventInvitee) {
    return null;
  }

  const max =
    maxRedemptions != null ? maxRedemptions : ev.defaultInviteLinkMaxRedemptions;
  const { raw, tokenHash } = inviteLinksService.mintRawToken();

  const existing = await inviteLinksService.findHostLinkByEventAndPersonInTx(
    tx,
    eventId,
    personId,
  );

  if (existing) {
    await inviteLinksService.updateHostLinkInTx(tx, existing.id, {
      token: raw,
      tokenHash,
      maxRedemptions: max,
    });
  } else {
    await inviteLinksService.insertHostLinkInTx(tx, {
      eventId,
      personId,
      maxRedemptions: max,
      token: raw,
      tokenHash,
    });
  }

  return raw;
}

export async function updateHostInviteLinkMaxRedemptions(
  eventId: string,
  linkId: string,
  maxRedemptions: number,
): Promise<{ id: string; maxRedemptions: number }> {
  await eventsService.requireInviteOnly(eventId);

  const link = await inviteLinksService.getHostLinkRow(eventId, linkId);
  if (!link) {
    throw new InviteLinkUpdateError("Invite link not found.", "not_found");
  }
  if (link.inviterId == null) {
    throw new InviteLinkUpdateError("Only host invite links can be updated.", "not_host_link");
  }

  const used = await ordersService.countPendingOrPaidForInviteLink(linkId);
  if (maxRedemptions < used) {
    throw new InviteLinkUpdateError(
      `Max redemptions cannot be below ${used} (already used or pending).`,
      "below_used",
    );
  }

  return inviteLinksService.updateMaxRedemptionsForLink(linkId, maxRedemptions);
}

export async function deleteHostInviteLink(
  eventId: string,
  linkId: string,
): Promise<{ id: string }> {
  await eventsService.requireInviteOnly(eventId);

  const link = await inviteLinksService.getHostLinkRow(eventId, linkId);
  if (!link) {
    throw new InviteLinkDeleteError("Invite link not found.", "not_found");
  }

  const used = await ordersService.countPendingOrPaidForInviteLink(linkId);
  if (used > 0) {
    throw new InviteLinkDeleteError(
      `Cannot delete: ${used} redemption(s) already recorded (pending or paid).`,
      "in_use",
    );
  }

  await inviteLinksService.deleteById(linkId);
  return { id: linkId };
}
