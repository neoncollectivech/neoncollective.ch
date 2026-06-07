/** Single TTL for email, SMS, and post-checkout registration exchange codes. */
export const REGISTRATION_EXCHANGE_TTL_MS = 600_000;

/** Crockford Base32 subset: no 0,1,I,L,O,U — 32 symbols so `byte % 32` is unbiased. */
export const REGISTRATION_CODE_ALPHABET =
  "23456789ABCDEFGHJKMNPQRSTVWXYZ" as const;

export const REGISTRATION_CODE_LENGTH = 6;

/** Sliding-window limit for OTP send requests per client IP. */
export const REGISTRATION_REQUEST_RATE_SCOPE = "registration_request";
export const REGISTRATION_REQUEST_RATE_WINDOW_MS = 15 * 60 * 1000;
export const REGISTRATION_REQUEST_RATE_MAX_ATTEMPTS = 5;

/** Per-contact cap on OTP sends (hashed contact as key). */
export const REGISTRATION_REQUEST_CONTACT_RATE_SCOPE = "registration_request_contact";
export const REGISTRATION_REQUEST_CONTACT_RATE_WINDOW_MS = 60 * 60 * 1000;
export const REGISTRATION_REQUEST_CONTACT_RATE_MAX_ATTEMPTS = 3;

/** Sliding-window limit for registration code exchange attempts per client IP. */
export const REGISTRATION_EXCHANGE_RATE_SCOPE = "registration_exchange";
