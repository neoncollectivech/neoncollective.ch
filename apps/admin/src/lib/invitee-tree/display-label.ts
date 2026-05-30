import type { EventInviteeListRow, PersonRow } from "@/lib/admin-api";
import type { ForeignKeyLookupRow } from "@/lib/admin-fk-services";

export function personFromLookup(
  personId: string | null | undefined,
  lookup: Map<string, ForeignKeyLookupRow> | undefined,
): PersonRow | undefined {
  if (!personId || !lookup) {
    return undefined;
  }

  return lookup.get(personId) as PersonRow | undefined;
}

export function displayName(
  invitee: EventInviteeListRow,
  personLookup: Map<string, ForeignKeyLookupRow> | undefined,
): string {
  const person = personFromLookup(invitee.personId, personLookup);

  if (person) {
    const name = [person.givenName, person.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (name) {
      return name;
    }
  }

  if (invitee.email) {
    return invitee.email;
  }

  if (invitee.phone) {
    return `+${invitee.phone}`;
  }

  return "Unknown";
}

export function initials(
  invitee: EventInviteeListRow,
  personLookup: Map<string, ForeignKeyLookupRow> | undefined,
): string {
  const person = personFromLookup(invitee.personId, personLookup);

  if (person?.givenName || person?.familyName) {
    const given = person.givenName?.trim().charAt(0) ?? "";
    const family = person.familyName?.trim().charAt(0) ?? "";
    const combined = `${given}${family}`.toUpperCase();

    if (combined) {
      return combined;
    }
  }

  const label = displayName(invitee, personLookup);
  const parts = label.split(/[\s@.+_-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return "?";
}

export function matchesSearch(
  invitee: EventInviteeListRow,
  personLookup: Map<string, ForeignKeyLookupRow> | undefined,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  const haystack = [
    displayName(invitee, personLookup),
    invitee.email ?? "",
    invitee.phone ?? "",
    invitee.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}
