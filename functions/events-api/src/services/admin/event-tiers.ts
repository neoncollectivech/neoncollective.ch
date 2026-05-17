import { asc, eq } from "drizzle-orm";

import { getDb } from "../../db/index.js";
import { eventTiers, events } from "../../db/schema.js";

export type TierInput = {
  id: string | null;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  quota: number | null;
  sortOrder: number;
  active: boolean;
};

export async function replaceEventTiers(
  eventId: string,
  tiers: TierInput[],
): Promise<{ tiers: (typeof eventTiers.$inferSelect)[] } | { error: string; status: number }> {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) {
    return { error: "Event not found.", status: 404 };
  }

  const result = await db.transaction(async (tx) => {
    await tx.delete(eventTiers).where(eq(eventTiers.eventId, eventId));
    if (tiers.length === 0) {
      return [];
    }
    return tx
      .insert(eventTiers)
      .values(
        tiers.map((t) => ({
          eventId,
          name: t.name,
          description: t.description,
          priceCents: t.priceCents,
          currency: t.currency.toLowerCase(),
          quota: t.quota,
          sortOrder: t.sortOrder,
          active: t.active,
        })),
      )
      .returning();
  });

  return { tiers: result };
}

export async function listTiersForEvent(eventId: string) {
  const db = getDb();
  return db
    .select()
    .from(eventTiers)
    .where(eq(eventTiers.eventId, eventId))
    .orderBy(asc(eventTiers.sortOrder));
}
