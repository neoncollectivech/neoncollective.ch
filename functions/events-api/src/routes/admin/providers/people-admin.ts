import { toPersonRow } from "../../../helpers/profile";
import { eventInviteesService } from "../../../services/event-invitees.service";
import { peopleService } from "../../../services/people.service";

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
