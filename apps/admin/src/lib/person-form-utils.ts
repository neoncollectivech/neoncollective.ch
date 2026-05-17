import type { PersonDetail } from "@/lib/admin-types";

export type PersonEditForm = {
  givenName: string;
  familyName: string;
  email: string;
  phoneE164: string;
};

export function personToEditForm(person: PersonDetail): PersonEditForm {
  return {
    givenName: person.givenName,
    familyName: person.familyName,
    email: person.email ?? "",
    phoneE164: person.phone ? `+${person.phone}` : "",
  };
}

export function personEditFormToPayload(form: PersonEditForm) {
  return {
    givenName: form.givenName.trim(),
    familyName: form.familyName.trim(),
    email: form.email.trim() || null,
    phoneE164: form.phoneE164.trim() || null,
  };
}
