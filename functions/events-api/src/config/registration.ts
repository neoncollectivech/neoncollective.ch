/** Single TTL for email, SMS, and post-checkout registration exchange codes. */
export const REGISTRATION_EXCHANGE_TTL_MS = 600_000;

/** Crockford Base32 subset: no 0,1,I,L,O,U — 32 symbols so `byte % 32` is unbiased. */
export const REGISTRATION_CODE_ALPHABET =
  "23456789ABCDEFGHJKMNPQRSTVWXYZ" as const;

export const REGISTRATION_CODE_LENGTH = 6;
