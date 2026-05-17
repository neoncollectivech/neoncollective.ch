export type PersonVerificationFields = {
  email: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};

export function personNeedsVerification(
  person: PersonVerificationFields,
): boolean {
  const needsEmail = Boolean(person.email?.trim()) && !person.emailVerifiedAt;
  const needsPhone = Boolean(person.phone?.trim()) && !person.phoneVerifiedAt;

  return needsEmail || needsPhone;
}

export function personVerificationSummary(
  person: PersonVerificationFields,
): string {
  const parts: string[] = [];

  if (person.email?.trim()) {
    parts.push(person.emailVerifiedAt ? "Email verified" : "Email pending");
  }
  if (person.phone?.trim()) {
    parts.push(person.phoneVerifiedAt ? "Phone verified" : "Phone pending");
  }

  return parts.length > 0 ? parts.join(" · ") : "No contact";
}
