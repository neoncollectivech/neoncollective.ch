import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { eventInvitees, events, inviteLinks, orders } from "../db/schema.js";
import { randomTokenHex, sha256Hex } from "../token.js";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

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

  const [roster] = await tx
    .select({ id: eventInvitees.id })
    .from(eventInvitees)
    .where(
      and(
        eq(eventInvitees.eventId, eventId),
        eq(eventInvitees.personId, personId),
        isNull(eventInvitees.revokedAt),
      ),
    )
    .limit(1);
  if (!roster) {
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

/** Lazy repair when a paid roster member views the event but has no host link yet. */
export async function ensureHostInviteLinkForPaidRosterPerson(
  eventId: string,
  personId: string,
): Promise<string | null> {
  const db = getDb();
  const [paid] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.eventId, eventId), eq(orders.personId, personId), eq(orders.status, "paid")),
    )
    .limit(1);
  if (!paid) {
    return null;
  }
  return db.transaction((tx) => ensureHostInviteLinkForPersonInTx(tx, eventId, personId));
}
