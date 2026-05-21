import { and, eq } from "drizzle-orm";

import { getDb } from "../db/index";
import { events, inviteLinks } from "../db/schema";
import { eventInviteesService } from "./event-invitees.service";
import { randomTokenHex, sha256Hex } from "../token";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function isFirstDegreeHostForEvent(
  eventId: string,
  personId: string,
): Promise<boolean> {
  const row = await eventInviteesService.findFirstDegreeHostOnEvent(eventId, personId);
  return row != null;
}

/**
 * Ensure a host-issued share link exists (inviterId = person).
 * Used after paid checkout, admin regenerate for materialized invitees, and lazy repair on event page.
 */
export async function ensureHostInviteLinkForPersonInTx(
  tx: DbTx,
  eventId: string,
  personId: string,
): Promise<string | null> {
  const [ev] = await tx
    .select({
      accessMode: events.accessMode,
      defaultInviteLinkMaxRedemptions: events.defaultInviteLinkMaxRedemptions,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
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

  const [existing] = await tx
    .select({ id: inviteLinks.id, token: inviteLinks.token })
    .from(inviteLinks)
    .where(and(eq(inviteLinks.eventId, eventId), eq(inviteLinks.inviterId, personId)))
    .limit(1);
  if (existing) {
    return existing.token;
  }

  const raw = randomTokenHex(24);
  await tx.insert(inviteLinks).values({
    eventId,
    inviterId: personId,
    maxRedemptions: ev.defaultInviteLinkMaxRedemptions,
    token: raw,
    tokenHash: sha256Hex(raw),
  });
  return raw;
}

/** Create or rotate the host share link issued in this person's name (inviterId = personId). */
export async function mintOrRotateHostInviteLinkForPersonInTx(
  tx: DbTx,
  eventId: string,
  personId: string,
  maxRedemptions?: number | null,
): Promise<string | null> {
  const [ev] = await tx
    .select({
      accessMode: events.accessMode,
      defaultInviteLinkMaxRedemptions: events.defaultInviteLinkMaxRedemptions,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
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
  const raw = randomTokenHex(24);
  const tokenHash = sha256Hex(raw);

  const [existing] = await tx
    .select({ id: inviteLinks.id })
    .from(inviteLinks)
    .where(and(eq(inviteLinks.eventId, eventId), eq(inviteLinks.inviterId, personId)))
    .limit(1);

  if (existing) {
    await tx
      .update(inviteLinks)
      .set({
        token: raw,
        tokenHash,
        maxRedemptions: max,
        rotatedAt: new Date(),
      })
      .where(eq(inviteLinks.id, existing.id));
  } else {
    await tx.insert(inviteLinks).values({
      eventId,
      inviterId: personId,
      maxRedemptions: max,
      token: raw,
      tokenHash,
    });
  }

  return raw;
}
