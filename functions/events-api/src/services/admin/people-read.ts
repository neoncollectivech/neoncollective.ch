import { eq } from "drizzle-orm";

import { getDb } from "../../db/index";
import { eventInvitees, events, orders, people } from "../../db/schema";

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
