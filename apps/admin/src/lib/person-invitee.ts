import type { PersonRow } from "@/lib/admin-api";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";

export function personToInviteePayload(
  person: PersonRow,
): InviteeUpsertPayload | null {
  const email = person.email?.trim() || null;
  const phoneDigits = person.phone?.trim();

  if (!email && !phoneDigits) {
    return null;
  }

  return {
    givenName: person.givenName,
    familyName: person.familyName,
    email,
    phoneE164: phoneDigits ? `+${phoneDigits}` : null,
    notes: null,
    maxRedemptions: null,
  };
}

export function canInvitePerson(person: PersonRow): boolean {
  return personToInviteePayload(person) != null;
}
