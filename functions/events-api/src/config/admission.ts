/** JWT `iss` — NEON admission credentials. */
export const ADMISSION_JWT_ISS = "neon-admissions";

/** JWT `aud` — door scanners and check-in API. */
export const ADMISSION_JWT_AUD = "neon-door";

/** Grace after estimated event end before credentials expire. */
export const ADMISSION_CREDENTIAL_EVENT_END_GRACE_MS = 24 * 60 * 60 * 1000;

/** When `events.startsAt` is set, assume this duration until end-of-event estimate. */
export const ADMISSION_CREDENTIAL_DEFAULT_EVENT_DURATION_MS = 12 * 60 * 60 * 1000;

/** Fallback TTL when event has no schedule. */
export const ADMISSION_CREDENTIAL_FALLBACK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Clock skew tolerance for offline door JWT verification. */
export const ADMISSION_JWT_CLOCK_TOLERANCE_SEC = 60;

export function admissionCredentialExpiresAt(params: {
  eventStartsAt: Date | null;
  now?: Date;
}): Date {
  const now = params.now ?? new Date();

  if (params.eventStartsAt) {
    const eventEndEstimate = new Date(
      params.eventStartsAt.getTime() + ADMISSION_CREDENTIAL_DEFAULT_EVENT_DURATION_MS,
    );
    return new Date(eventEndEstimate.getTime() + ADMISSION_CREDENTIAL_EVENT_END_GRACE_MS);
  }

  return new Date(now.getTime() + ADMISSION_CREDENTIAL_FALLBACK_TTL_MS);
}
