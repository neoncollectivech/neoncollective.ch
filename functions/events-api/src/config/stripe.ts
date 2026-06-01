import type Stripe from "stripe";

/** Card + TWINT for event checkout (TWINT requires redirect; client passes `return_url`). */
export const PAYMENT_INTENT_METHOD_TYPES: Stripe.PaymentIntentCreateParams["payment_method_types"] =
  ["twint", "card"];
