import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../../db/index";
import { admissions, eventTiers, events, orderTiers } from "../../db/schema";

export type TierInput = {
  id: string | null;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  quota: number | null;
  sortOrder: number;
  active: boolean;
  selectionMode: "exclusive" | "addon";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

async function tierReferenceCountTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  tierId: string,
): Promise<number> {
  const [orderRefs] = await tx
    .select({ qty: sql<number>`count(*)::int` })
    .from(orderTiers)
    .where(eq(orderTiers.eventTierId, tierId));
  const [admissionRefs] = await tx
    .select({ qty: sql<number>`count(*)::int` })
    .from(admissions)
    .where(eq(admissions.eventTierId, tierId));
  return Number(orderRefs?.qty ?? 0) + Number(admissionRefs?.qty ?? 0);
}

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
    const existing = await tx
      .select()
      .from(eventTiers)
      .where(eq(eventTiers.eventId, eventId));

    const existingById = new Map(existing.map((t) => [t.id, t]));
    const keptIds: string[] = [];

    for (const tier of tiers) {
      if (!isUuid(tier.id)) {
        continue;
      }
      if (!existingById.has(tier.id!)) {
        return {
          error: `Unknown tier id "${tier.id}" for this event.`,
          status: 400 as const,
        };
      }
      keptIds.push(tier.id!);
    }

    const toRemove = existing.filter((t) => !keptIds.includes(t.id));
    for (const tier of toRemove) {
      const refs = await tierReferenceCountTx(tx, tier.id);
      if (refs > 0) {
        return {
          error: `Cannot remove tier "${tier.name}" — it is used by existing orders. Deactivate it instead.`,
          status: 409 as const,
        };
      }
    }

    if (toRemove.length > 0) {
      await tx.delete(eventTiers).where(
        inArray(
          eventTiers.id,
          toRemove.map((t) => t.id),
        ),
      );
    }

    const updated: (typeof eventTiers.$inferSelect)[] = [];

    for (const tier of tiers) {
      const values = {
        name: tier.name,
        description: tier.description,
        priceCents: tier.priceCents,
        currency: tier.currency.toLowerCase(),
        quota: tier.quota,
        sortOrder: tier.sortOrder,
        active: tier.active,
        selectionMode: tier.selectionMode,
      };

      if (isUuid(tier.id) && existingById.has(tier.id)) {
        const tierId = tier.id;
        const [row] = await tx
          .update(eventTiers)
          .set(values)
          .where(and(eq(eventTiers.id, tierId), eq(eventTiers.eventId, eventId)))
          .returning();
        if (row) {
          updated.push(row);
        }
        continue;
      }

      const [row] = await tx
        .insert(eventTiers)
        .values({
          eventId,
          ...values,
        })
        .returning();
      if (row) {
        updated.push(row);
      }
    }

    updated.sort((a, b) => a.sortOrder - b.sortOrder);
    return updated;
  });

  if (!Array.isArray(result)) {
    return result;
  }

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
