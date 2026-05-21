import { GENERIC_NAMES } from "../config/profile";
import { normalizeEmailTypo } from "./contact";

export type PersonRow = {
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
};

export function toPersonRow(
  row: PersonRow | null | undefined,
): PersonRow | null {
  if (!row) {
    return null;
  }
  return {
    givenName: row.givenName,
    familyName: row.familyName,
    email: row.email,
    phone: row.phone,
    emailVerifiedAt: row.emailVerifiedAt,
    phoneVerifiedAt: row.phoneVerifiedAt,
  };
}

export function normalizeStoredEmail(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  return normalizeEmailTypo(raw.trim()).toLowerCase();
}

export function profileContactFieldsMatch(
  existing: PersonRow,
  next: {
    givenName: string;
    familyName: string;
    email: string | null;
    phoneDigits: string | null;
    phoneE164: string | null;
  },
): boolean {
  return (
    existing.givenName === next.givenName &&
    existing.familyName === next.familyName &&
    normalizeStoredEmail(existing.email) === next.email &&
    (existing.phone ?? null) === next.phoneDigits
  );
}

export function isProfileComplete(person: PersonRow | null): boolean {
  if (!person) {
    return false;
  }
  const gn = person.givenName.trim();
  const fn = person.familyName.trim();
  if (!gn || !fn) {
    return false;
  }
  if (GENERIC_NAMES.test(gn) || GENERIC_NAMES.test(fn)) {
    return false;
  }
  return Boolean(person.email?.trim() || person.phone?.trim());
}

export function isEmailVerified(person: PersonRow): boolean {
  return Boolean(person.email?.trim() && person.emailVerifiedAt);
}

export function isPhoneVerified(person: PersonRow): boolean {
  return Boolean(person.phone?.trim() && person.phoneVerifiedAt);
}

export function pendingVerificationChannel(
  person: PersonRow,
): "email" | "phone" | null {
  const hasEmail = Boolean(person.email?.trim());
  const hasPhone = Boolean(person.phone?.trim());
  if (hasEmail && !isEmailVerified(person)) {
    return "email";
  }
  if (hasPhone && !isPhoneVerified(person)) {
    return "phone";
  }
  return null;
}

export function e164FromStoredDigits(stored: string | null | undefined): string | null {
  const digits = stored?.trim();
  if (!digits) {
    return null;
  }
  return `+${digits.replace(/\D/g, "")}`;
}

export function personHasEmailField(person: PersonRow): boolean {
  return Boolean(person.email?.trim());
}

export function personHasPhoneField(person: PersonRow): boolean {
  return Boolean(person.phone?.trim());
}

export function hasMinimumPersonIdentity(fields: {
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
}): boolean {
  const gn = fields.givenName.trim();
  const fn = fields.familyName.trim();
  if (!gn || !fn) {
    return false;
  }
  if (GENERIC_NAMES.test(gn) || GENERIC_NAMES.test(fn)) {
    return false;
  }
  const email = fields.email?.trim();
  const phone = fields.phoneE164?.trim();
  return Boolean(email || phone);
}
