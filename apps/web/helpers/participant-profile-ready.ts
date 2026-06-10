import type { ParticipantProfile } from "@/helpers/eventsApi";

/** Every contact field on the profile is present and verified. */
export function areParticipantContactsVerified(
  profile: ParticipantProfile | null | undefined,
): boolean {
  if (!profile) {
    return false;
  }
  const emailOk = !profile.email?.trim() || profile.emailVerified;
  const phoneOk = !profile.phoneE164?.trim() || profile.phoneVerified;
  return emailOk && phoneOk;
}

export function isParticipantProfileReadyForCheckout(
  profile: ParticipantProfile | null | undefined,
): boolean {
  if (!profile?.profileComplete) {
    return false;
  }
  return areParticipantContactsVerified(profile);
}
