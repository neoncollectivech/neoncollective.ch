import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { inviteLinks, orders } from "../db/schema";
import { getInviteRedemptionQty, requireInviteOnlyEvent } from "./event-read";

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

export async function updateInviteLinkMaxRedemptions(
  eventId: string,
  linkId: string,
  maxRedemptions: number,
): Promise<{ id: string; maxRedemptions: number }> {
  await requireInviteOnlyEvent(eventId);
  const db = getDb();

  const [link] = await db
    .select({
      id: inviteLinks.id,
      inviterId: inviteLinks.inviterId,
      maxRedemptions: inviteLinks.maxRedemptions,
    })
    .from(inviteLinks)
    .where(and(eq(inviteLinks.id, linkId), eq(inviteLinks.eventId, eventId)))
    .limit(1);

  if (!link) {
    throw new InviteLinkUpdateError("Invite link not found.", "not_found");
  }
  if (link.inviterId == null) {
    throw new InviteLinkUpdateError("Only host invite links can be updated.", "not_host_link");
  }

  const used = await getInviteRedemptionQty(linkId);
  if (maxRedemptions < used) {
    throw new InviteLinkUpdateError(
      `Max redemptions cannot be below ${used} (already used or pending).`,
      "below_used",
    );
  }

  const [updated] = await db
    .update(inviteLinks)
    .set({ maxRedemptions })
    .where(eq(inviteLinks.id, linkId))
    .returning({ id: inviteLinks.id, maxRedemptions: inviteLinks.maxRedemptions });

  return updated!;
}

/** Remove an invite link when it has no pending or paid redemptions yet. */
export async function deleteInviteLink(
  eventId: string,
  linkId: string,
): Promise<{ id: string }> {
  await requireInviteOnlyEvent(eventId);
  const db = getDb();

  const [link] = await db
    .select({ id: inviteLinks.id })
    .from(inviteLinks)
    .where(and(eq(inviteLinks.id, linkId), eq(inviteLinks.eventId, eventId)))
    .limit(1);

  if (!link) {
    throw new InviteLinkDeleteError("Invite link not found.", "not_found");
  }

  const used = await getInviteRedemptionQty(linkId);
  if (used > 0) {
    throw new InviteLinkDeleteError(
      `Cannot delete: ${used} redemption(s) already recorded (pending or paid).`,
      "in_use",
    );
  }

  await db.delete(inviteLinks).where(eq(inviteLinks.id, linkId));
  return { id: linkId };
}

/** Batch count pending+paid orders per invite link. */
export async function getInviteRedemptionQtyByLinkIds(
  linkIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (linkIds.length === 0) {
    return map;
  }

  const db = getDb();
  const rows = await db
    .select({
      inviteLinkId: orders.inviteLinkId,
      qty: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.inviteLinkId, linkIds),
        inArray(orders.status, ["pending", "paid"]),
      ),
    )
    .groupBy(orders.inviteLinkId);

  for (const row of rows) {
    if (row.inviteLinkId) {
      map.set(row.inviteLinkId, Number(row.qty ?? 0));
    }
  }
  return map;
}
