import { and, asc, eq } from "drizzle-orm";

import { getDb } from "../../db/index.js";
import { eventInvitees, inviteLinks, people } from "../../db/schema.js";
import { e164FromStoredDigits } from "../../profile.js";
import { getInviteRedemptionQtyByLinkIds } from "../admin-invite-links.js";

export async function listAdminInviteesForEvent(eventId: string) {
  const db = getDb();
  const rows = await db
    .select({
      invitee: eventInvitees,
      person: people,
    })
    .from(eventInvitees)
    .leftJoin(people, eq(people.id, eventInvitees.personId))
    .where(eq(eventInvitees.eventId, eventId))
    .orderBy(asc(eventInvitees.createdAt));

  const links = await db
    .select({
      id: inviteLinks.id,
      inviterId: inviteLinks.inviterId,
      token: inviteLinks.token,
      maxRedemptions: inviteLinks.maxRedemptions,
      rotatedAt: inviteLinks.rotatedAt,
    })
    .from(inviteLinks)
    .where(eq(inviteLinks.eventId, eventId));

  const hostLinkIds = links.filter((l) => l.inviterId != null).map((l) => l.id);
  const usedByLinkId = await getInviteRedemptionQtyByLinkIds(hostLinkIds);

  return rows.map((r) => formatInviteeRow(r, links, usedByLinkId));
}

export async function getAdminInviteeDetail(eventId: string, inviteeId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      invitee: eventInvitees,
      person: people,
    })
    .from(eventInvitees)
    .leftJoin(people, eq(people.id, eventInvitees.personId))
    .where(and(eq(eventInvitees.id, inviteeId), eq(eventInvitees.eventId, eventId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const links = await db
    .select({
      id: inviteLinks.id,
      inviterId: inviteLinks.inviterId,
      token: inviteLinks.token,
      maxRedemptions: inviteLinks.maxRedemptions,
      rotatedAt: inviteLinks.rotatedAt,
    })
    .from(inviteLinks)
    .where(eq(inviteLinks.eventId, eventId));

  const hostLinkIds = links.filter((l) => l.inviterId != null).map((l) => l.id);
  const usedByLinkId = await getInviteRedemptionQtyByLinkIds(hostLinkIds);

  return formatInviteeRow(row, links, usedByLinkId);
}

type InviteLinkRow = {
  id: string;
  inviterId: string | null;
  token: string;
  maxRedemptions: number;
  rotatedAt: Date | null;
};

function formatHostInviteLink(
  hostLink: InviteLinkRow,
  usedByLinkId: Map<string, number>,
) {
  const usedRedemptions = usedByLinkId.get(hostLink.id) ?? 0;
  const remainingRedemptions = Math.max(0, hostLink.maxRedemptions - usedRedemptions);
  return {
    id: hostLink.id,
    token: hostLink.token,
    maxRedemptions: hostLink.maxRedemptions,
    usedRedemptions,
    remainingRedemptions,
    rotatedAt: hostLink.rotatedAt,
  };
}

function formatInviteeRow(
  r: {
    invitee: typeof eventInvitees.$inferSelect;
    person: typeof people.$inferSelect | null;
  },
  links: InviteLinkRow[],
  usedByLinkId: Map<string, number>,
) {
  const person = r.person;
  const pendingEmail = r.invitee.email;
  const pendingPhone = r.invitee.phone;
  const hostLink =
    r.invitee.personId != null && r.invitee.inviterId == null
      ? links.find((l) => l.inviterId === r.invitee.personId) ?? null
      : null;
  const adminLinks = links.filter((l) => l.inviterId === null);

  return {
    id: r.invitee.id,
    eventId: r.invitee.eventId,
    personId: r.invitee.personId,
    inviterId: r.invitee.inviterId,
    profilePending: r.invitee.personId == null,
    notes: r.invitee.notes,
    revokedAt: r.invitee.revokedAt,
    createdAt: r.invitee.createdAt,
    person: {
      id: person?.id ?? null,
      givenName: person?.givenName ?? "",
      familyName: person?.familyName ?? "",
      email: person?.email ?? pendingEmail,
      phone: person?.phone ?? pendingPhone,
      phoneE164: e164FromStoredDigits(person?.phone ?? pendingPhone ?? null),
    },
    hostInviteLink: hostLink ? formatHostInviteLink(hostLink, usedByLinkId) : null,
    adminInviteLinks: adminLinks.map((l) => ({
      id: l.id,
      maxRedemptions: l.maxRedemptions,
      rotatedAt: l.rotatedAt,
    })),
  };
}
