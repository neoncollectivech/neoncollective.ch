import { asc, eq } from "drizzle-orm";

import { getDb } from "../../db/index";
import {
  admissions,
  eventTiers,
  events,
  inviteRedemptions,
  orders,
  orderTiers,
  people,
} from "../../db/schema";

export type AdminOrderTierLine = {
  id: string;
  name: string;
  selectionMode: "exclusive" | "addon";
  unitPriceCents: number;
};

export async function listOrderTierLines(orderId: string): Promise<AdminOrderTierLine[]> {
  const db = getDb();
  return db
    .select({
      id: eventTiers.id,
      name: eventTiers.name,
      selectionMode: eventTiers.selectionMode,
      unitPriceCents: orderTiers.unitPriceCents,
    })
    .from(orderTiers)
    .innerJoin(eventTiers, eq(eventTiers.id, orderTiers.eventTierId))
    .where(eq(orderTiers.orderId, orderId))
    .orderBy(asc(eventTiers.sortOrder));
}

export async function getAdminOrderDetail(orderId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      order: orders,
      person: people,
      event: events,
    })
    .from(orders)
    .innerJoin(people, eq(people.id, orders.personId))
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) {
    return null;
  }

  const tiers = await listOrderTierLines(orderId);

  const [admission] = await db
    .select()
    .from(admissions)
    .where(eq(admissions.orderId, orderId))
    .limit(1);

  const [redemption] = await db
    .select()
    .from(inviteRedemptions)
    .where(eq(inviteRedemptions.orderId, orderId))
    .limit(1);

  return {
    ...row.order,
    person: row.person,
    tiers,
    event: { id: row.event.id, slug: row.event.slug, title: row.event.title },
    admission: admission ?? null,
    inviteRedemption: redemption ?? null,
  };
}

export function serializeAdminOrderListRow(row: {
  order: typeof orders.$inferSelect;
  person: typeof people.$inferSelect;
  tierLabel: string;
  event: { id: string; slug: string; title: string };
}) {
  return {
    id: row.order.id,
    eventId: row.order.eventId,
    status: row.order.status,
    amountCents: row.order.amountCents,
    createdAt: row.order.createdAt,
    person: {
      id: row.person.id,
      givenName: row.person.givenName,
      familyName: row.person.familyName,
      email: row.person.email,
    },
    tierLabel: row.tierLabel,
    event: row.event,
  };
}
