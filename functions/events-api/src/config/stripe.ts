import type Stripe from "stripe";

/** Card-only Elements checkout — no redirect PMs, so confirm does not require `return_url`. */
export const PAYMENT_INTENT_AUTOMATIC_METHODS: Stripe.PaymentIntentCreateParams.AutomaticPaymentMethods =
  {
    enabled: true,
    allow_redirects: "never",
  };
