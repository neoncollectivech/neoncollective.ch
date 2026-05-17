import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb } from "../../db/index.js";
import {
  admissions,
  eventTiers,
  events,
  inviteRedemptions,
  orders,
  orderTiers,
  people,
} from "../../db/schema.js";

export type AdminOrderTierLine = {
  id: string;
  name: string;
  selectionMode: "exclusive" | "addon";
  unitPriceCents: number;
};

async function listOrderTierLines(orderId: string): Promise<AdminOrderTierLine[]> {
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

export async function listAdminOrdersQuery(params: {
  eventId?: string;
  status?: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const db = getDb();
  const conditions = [];
  if (params.eventId) {
    conditions.push(eq(orders.eventId, params.eventId));
  }
  if (params.status) {
    conditions.push(eq(orders.status, params.status as typeof orders.$inferSelect.status));
  }
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(people.email, term),
        ilike(people.givenName, term),
        ilike(people.familyName, term),
        ilike(events.title, term),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (params.page - 1) * params.pageSize;

  const rows = await db
    .select({
      order: orders,
      person: people,
      event: { id: events.id, slug: events.slug, title: events.title },
    })
    .from(orders)
    .innerJoin(people, eq(people.id, orders.personId))
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  const items = [];
  for (const row of rows) {
    const tierLines = await listOrderTierLines(row.order.id);
    const tierLabel =
      tierLines.length > 0
        ? tierLines.map((t) => t.name).join(" + ")
        : "—";
    items.push(
      serializeAdminOrderListRow({
        order: row.order,
        person: row.person,
        tierLabel,
        event: row.event,
      }),
    );
  }

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(people, eq(people.id, orders.personId))
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(whereClause);

  return {
    items,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total: countRow?.total ?? 0,
    },
  };
}
