import { type } from "arktype";

export const checkoutIntentSchema = type({
  slug: "string",
  /** Omitted or null when the session profile already has a verified phone. */
  email: "string.email | null",
  locale: "'de' | 'en' | 'it'",
  phoneE164: "string | null",
  inviteToken: "string | null",
  tierId: "string",
});

/** After Stripe confirms payment in the browser; webhook reconciles the same order idempotently. */
export const checkoutConfirmSchema = type({
  orderId: "string",
});

export const sessionRequestSchema = type({
  contact: "string",
  locale: "'de' | 'en' | 'it'",
  returnUrl: "string",
});

export const sessionExchangeSchema = type({
  code: "string",
});

export const sessionPhoneSchema = type({
  phoneE164: "string",
});

export const anonymousSessionSchema = type({
  inviteToken: "string | null",
});

export const profileUpdateSchema = type({
  givenName: "string",
  familyName: "string",
  email: "string.email | null",
  phoneE164: "string | null",
});

export const profileVerificationRequestSchema = type({
  channel: "'email' | 'phone'",
  locale: "'de' | 'en' | 'it'",
});

export const profileVerificationConfirmSchema = type({
  code: "string",
});

export const checkInSchema = type({
  token: "string",
});

export const adminInviteesUpsertSchema = type({
  invitees: type({
    givenName: "string",
    familyName: "string",
    email: "string.email | null",
    phoneE164: "string | null",
    maxRedemptions: "number | null",
    notes: "string | null",
  }).array(),
});
