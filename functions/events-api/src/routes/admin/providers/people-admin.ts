import { eventInviteesService } from "../../../services/event-invitees.service";
import { eventsService } from "../../../services/events.service";
import { ordersService } from "../../../services/orders.service";
import { peopleService } from "../../../services/people.service";
import { toPersonRow } from "../../../helpers/profile";

export async function getAdminPersonDetail(id: string) {
  const person = await peopleService.get(id);
  if (!person) {
    return null;
  }

  const [personOrders, invitees] = await Promise.all([
    ordersService.listByPersonId(id),
    eventInviteesService.listByPersonId(id),
  ]);

  const eventIds = [
    ...new Set([
      ...personOrders.map((o) => o.eventId),
      ...invitees.map((i) => i.eventId),
    ]),
  ];
  const events = await eventsService.getByIds(eventIds);
  const titleByEventId = new Map(events.map((e) => [e.id, e.title]));

  return {
    ...person,
    orders: personOrders.map((o) => ({
      id: o.id,
      eventId: o.eventId,
      status: o.status,
      amountCents: o.amountCents,
      createdAt: o.createdAt,
      eventTitle: titleByEventId.get(o.eventId) ?? "",
    })),
    invitees: invitees.map((i) => ({
      id: i.id,
      eventId: i.eventId,
      revokedAt: i.revokedAt,
      eventTitle: titleByEventId.get(i.eventId) ?? "",
    })),
  };
}

export async function verifyAdminPeopleBulk(personIds: string[]): Promise<{
  updated: number;
  skipped: number;
  notFound: number;
}> {
  const summary = await peopleService.verifyPeopleBulk(personIds);
  const uniqueIds = [...new Set(personIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return summary;
  }

  const rows = await peopleService.getByIds(uniqueIds);
  for (const person of rows) {
    const profile = toPersonRow(person);
    if (!profile) {
      continue;
    }
    await eventInviteesService.syncEventInviteesToPerson(person.id, {
      email: profile.email,
      phone: profile.phone,
    });
  }

  return summary;
}
