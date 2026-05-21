import Stripe from "stripe";

import { createLogger } from "@neon/server-kit";

const log = createLogger("stripe");

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

log.debug("Stripe client initialized");

export function resolveCheckoutReturnUrl(params: {
  returnPath?: string | null;
  locale: string;
  slug: string;
}): string {
  const site =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.EVENTS_ALLOWED_ORIGIN?.trim() ||
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
