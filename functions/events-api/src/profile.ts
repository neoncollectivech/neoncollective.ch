import type { InferSelectModel } from "drizzle-orm";

import { phoneToStoredDigits } from "./contact";
import type { people } from "./db/schema";

export type PersonRow = Pick<
  InferSelectModel<typeof people>,
  | "givenName"
  | "familyName"
  | "email"
  | "phone"
  | "emailVerifiedAt"
  | "phoneVerifiedAt"
>;

const GENERIC_NAMES = /^(guest|customer)$/i;

/** Minimum identity to create a people row (matches profile PATCH before OTP). */
export function hasMinimumPersonIdentity(params: {
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
}): boolean {
  const em = params.email?.trim().toLowerCase() ?? null;
  const phoneDigits = phoneToStoredDigits(params.phoneE164);
  const hasContact = Boolean(em || phoneDigits);
  return isRealPersonName(params.givenName, params.familyName) && hasContact;
}

export function isRealPersonName(givenName: string, familyName: string): boolean {
  const gn = givenName.trim();
  const fn = familyName.trim();
  if (!gn || !fn) {
    return false;
  }
  if (GENERIC_NAMES.test(gn) || GENERIC_NAMES.test(fn)) {
    return false;
  }
  return true;
}

/** Whether the user provided this channel in the profile form (non-empty). */
export function personHasEmailField(person: PersonRow): boolean {
  return Boolean(person.email?.trim());
}

export function personHasPhoneField(person: PersonRow): boolean {
  return Boolean(person.phone?.trim());
}

export function isEmailVerified(person: PersonRow): boolean {
  return personHasEmailField(person) && person.emailVerifiedAt != null;
}

export function isPhoneVerified(person: PersonRow): boolean {
  return personHasPhoneField(person) && person.phoneVerifiedAt != null;
}

/**
 * Profile is complete when names are real and every submitted contact channel is verified.
 */
export function isProfileComplete(person: PersonRow): boolean {
  if (!isRealPersonName(person.givenName, person.familyName)) {
    return false;
  }
  const hasEmail = personHasEmailField(person);
  const hasPhone = personHasPhoneField(person);
  if (!hasEmail && !hasPhone) {
    return false;
  }
  if (hasEmail && !isEmailVerified(person)) {
    return false;
  }
  if (hasPhone && !isPhoneVerified(person)) {
    return false;
  }
  return true;
}

/** Next channel that still needs OTP verification, or null when none pending. */
export function pendingVerificationChannel(
  person: PersonRow,
): "email" | "phone" | null {
  if (personHasEmailField(person) && !isEmailVerified(person)) {
    return "email";
  }
  if (personHasPhoneField(person) && !isPhoneVerified(person)) {
    return "phone";
  }
  return null;
}

export function e164FromStoredDigits(digits: string | null): string | null {
  if (!digits?.trim()) {
    return null;
  }
  return `+${digits.replace(/\D/g, "")}`;
}
