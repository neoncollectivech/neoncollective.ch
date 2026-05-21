import { eq } from "drizzle-orm";

import { getDb } from "../db/index";
import { events, inviteLinks, people } from "../db/schema";
import { sha256Hex } from "../token";

export type InviteLinkLookupTx = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export type InviteLinkByTokenRow = {
  link: typeof inviteLinks.$inferSelect;
  event: typeof events.$inferSelect;
  inviter: typeof people.$inferSelect | null;
};

export async function findInviteLinkByRawToken(
  rawToken: string,
  options?: { tx?: InviteLinkLookupTx; includeInviter?: boolean },
): Promise<InviteLinkByTokenRow | null> {
  const hash = sha256Hex(rawToken);
  const includeInviter = options?.includeInviter !== false;
  const executor = options?.tx ?? getDb();

  if (includeInviter) {
    const [row] = await executor
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

  const [row] = await executor
    .select({
      link: inviteLinks,
      event: events,
    })
    .from(inviteLinks)
    .innerJoin(events, eq(events.id, inviteLinks.eventId))
    .where(eq(inviteLinks.tokenHash, hash))
    .limit(1);
  if (!row) {
    return null;
  }
  return { link: row.link, event: row.event, inviter: null };
}
