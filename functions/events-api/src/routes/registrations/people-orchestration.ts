import { eventInviteesService } from "../../services/event-invitees.service";
import { eventsService } from "../../services/events.service";
import { ordersService } from "../../services/orders.service";
import { peopleService } from "../../services/people.service";

export async function resolvePersonIdForRegistrationContact(
  contact: { kind: "email"; email: string } | { kind: "phone"; e164: string },
): Promise<string | undefined> {
  if (contact.kind === "email") {
    const fromPeople = await peopleService.findPersonIdByEmail(contact.email);
    if (fromPeople) {
      return fromPeople;
    }
    return eventInviteesService.findLinkedPersonIdByEmail(contact.email);
  }
  const fromPeople = await peopleService.findPersonIdByPhoneE164(contact.e164);
  if (fromPeople) {
    return fromPeople;
  }
  return eventInviteesService.findLinkedPersonIdByPhoneE164(contact.e164);
}

export async function syncEventInviteesToPerson(personId: string): Promise<void> {
  const person = await peopleService.getProfileRow(personId);
  if (!person) {
    return;
  }
  await eventInviteesService.syncEventInviteesToPerson(personId, {
    email: person.email,
    phone: person.phone,
  });
}

export async function personHasRegistrationEligibility(personId: string): Promise<boolean> {
  if (await ordersService.hasOrderForPerson(personId)) {
    return true;
  }
  if (await hasLinkedPublishedInvitee(personId)) {
    return true;
  }
  if (await hasPublishedEventInviteContactMatch(personId)) {
    return true;
  }
  return false;
}

async function hasLinkedPublishedInvitee(personId: string): Promise<boolean> {
  const eventIds = await eventInviteesService.listActiveEventIdsForPerson(personId);
  return eventsService.hasAnyPublishedAmongIds(eventIds);
}

async function hasPublishedEventInviteContactMatch(personId: string): Promise<boolean> {
  const person = await peopleService.getProfileRow(personId);
  if (!person) {
    return false;
  }
  const eventIds = await eventInviteesService.listActiveEventIdsByContact({
    email: person.email,
    phone: person.phone,
  });
  return eventsService.hasAnyPublishedAmongIds(eventIds);
}
