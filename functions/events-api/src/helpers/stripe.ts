import { createLogger } from "@neon/server-kit";
import Stripe from "stripe";

import { getEventsApiEnv } from "../config/runtime-env";

const log = createLogger("stripe");

let stripeClient: Stripe | null = null;

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = getEventsApiEnv().stripeSecretKey;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = createStripeClient(key);
    log.debug("Stripe client initialized");
  }
  return stripeClient;
}

/** @deprecated Prefer `getStripe()` — kept for gradual migration. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});

export function resolveCheckoutReturnUrl(params: {
  returnPath?: string | null;
  locale: string;
  slug: string;
}): string {
  const env = getEventsApiEnv();
  const site =
    env.publicSiteUrl.trim() ||
    env.eventsAllowedOrigin?.trim() ||
    "http://localhost:3000";
  const origin = site.replace(/\/+$/, "");
  const path =
    params.returnPath?.trim() ||
    `/${params.locale}/events/private?slug=${encodeURIComponent(params.slug)}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;

  return `${origin}${normalized}`;
}

/** True when this PI can be confirmed without a redirect `return_url`. */
export function paymentIntentAllowsElementsConfirm(
  pi: Stripe.PaymentIntent,
): boolean {
  return pi.automatic_payment_methods?.allow_redirects === "never";
}

export function resetStripeClient(): void {
  stripeClient = null;
}
