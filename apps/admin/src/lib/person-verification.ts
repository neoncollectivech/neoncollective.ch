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
