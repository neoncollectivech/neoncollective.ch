import { type } from "arktype";

export const checkoutSchema = type({
  priceId: "string",
  mode: "'subscription' | 'payment'",
  locale: "'de' | 'en' | 'it'",
  successUrl: "string",
  cancelUrl: "string",
});

export const portalRequestSchema = type({
  email: "string.email",
  locale: "'de' | 'en' | 'it'",
  returnUrl: "string",
});
