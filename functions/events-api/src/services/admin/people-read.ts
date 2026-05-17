import { desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb } from "../../db/index.js";
import { eventInvitees, events, orders, people } from "../../db/schema.js";

export async function getAdminPersonDetail(personId: string) {
  const db = getDb();
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) {
    return null;
  }

  const personOrders = await db
    .select({
      id: orders.id,
      eventId: orders.eventId,
      status: orders.status,
      amountCents: orders.amountCents,
      createdAt: orders.createdAt,
      eventTitle: events.title,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.personId, personId))
    .orderBy(orders.createdAt);

  const invitees = await db
    .select({
      id: eventInvitees.id,
      eventId: eventInvitees.eventId,
      revokedAt: eventInvitees.revokedAt,
      eventTitle: events.title,
    })
    .from(eventInvitees)
    .innerJoin(events, eq(events.id, eventInvitees.eventId))
    .where(eq(eventInvitees.personId, personId));

  return {
    ...person,
    orders: personOrders,
    invitees,
  };
}

export async function searchAdminPeople(params: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  const db = getDb();
  const conditions = [];
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(people.email, term),
        ilike(people.givenName, term),
        ilike(people.familyName, term),
        ilike(people.phone, term),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? conditions[0] : undefined;
  const offset = (params.page - 1) * params.pageSize;

  const rows = await db
    .select()
    .from(people)
    .where(whereClause)
    .orderBy(desc(people.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(people)
    .where(whereClause);

  return {
    items: rows,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total: countRow?.total ?? 0,
    },
  };
}
