import { createLogger } from "@neon/server-kit";
import Stripe from "stripe";

import { getStripeApiEnv } from "./config/runtime-env";

const log = createLogger("stripe");

let stripeClient: Stripe | null = null;

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = getStripeApiEnv().stripeSecretKey;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = createStripeClient(key);
    log.debug("Stripe client initialized");
  }
  return stripeClient;
}
