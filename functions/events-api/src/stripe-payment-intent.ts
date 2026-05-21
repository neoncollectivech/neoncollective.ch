import type Stripe from "stripe";

/** Card-only Elements checkout — no redirect PMs, so confirm does not require `return_url`. */
export const PAYMENT_INTENT_AUTOMATIC_METHODS: Stripe.PaymentIntentCreateParams.AutomaticPaymentMethods =
  {
    enabled: true,
    allow_redirects: "never",
  };

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
