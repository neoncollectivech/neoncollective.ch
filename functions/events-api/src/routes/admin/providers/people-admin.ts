import { toPersonRow } from "../../../helpers/profile";
import { eventInviteesService } from "../../../services/event-invitees.service";
import {
  peopleService,
  type AdminPersonCreateInput,
  type PersonDeletionEligibility,
} from "../../../services/people.service";

export async function createAdminPerson(
  input: AdminPersonCreateInput,
): Promise<NonNullable<ReturnType<typeof toPersonRow>>> {
  return peopleService.createPersonForAdmin(input);
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

export async function getAdminPersonDeletionEligibility(
  personId: string,
): Promise<PersonDeletionEligibility | null> {
  const res = await peopleService.getPersonDeletionEligibilityForAdmin(personId);
  if (!res.ok) {
    return null;
  }
  return res.eligibility;
}

export async function deleteAdminPerson(
  personId: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: "person_not_found" | "person_has_links" }
> {
  const res = await peopleService.deletePersonForAdmin(personId);
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, reason: res.reason };
}
