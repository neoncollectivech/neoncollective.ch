import Stripe from "stripe";

let stripeClient = null;

/**
 * Stripe Visa test PAN for Switzerland (CH) — succeeds with CHF PaymentIntents.
 * @see https://docs.stripe.com/testing#international-cards
 */
export const STRIPE_CHF_SUCCESS_CARD = {
  number: "4000007560000009",
  exp: "12 / 34",
  cvc: "123",
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required for E2E payment confirmation.");
  }
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

function paymentIntentIdFromClientSecret(clientSecret) {
  const marker = "_secret_";
  const idx = clientSecret.indexOf(marker);
  if (idx === -1) {
    throw new Error("Invalid PaymentIntent client secret.");
  }
  return clientSecret.slice(0, idx);
}

/** Fill Stripe Payment Element fields (iframe) with the CH success test card. */
export async function fillStripePaymentElement(
  page,
  card = STRIPE_CHF_SUCCESS_CARD,
) {
  await page.getByTestId("event-checkout-pay").waitFor({
    state: "visible",
    timeout: 60_000,
  });

  const frame = page
    .frameLocator(
      'iframe[title*="Secure payment input frame"], iframe[src*="js.stripe.com"]',
    )
    .first();

  const cardNumber = frame.getByPlaceholder(/1234|card number/i);
  await cardNumber.waitFor({ state: "visible", timeout: 30_000 });
  await cardNumber.fill(card.number);

  const expiry = frame.getByPlaceholder(/MM|expir/i);
  await expiry.fill(card.exp);

  const cvc = frame.getByPlaceholder(/CVC|cvc|security code/i);
  await cvc.fill(card.cvc);
}

/** Optional server-side confirm (pm_card_ch) — prefer fill + Pay for real Elements flow. */
export async function confirmPaymentIntentClientSecret(
  clientSecret,
  returnUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000",
) {
  const stripe = getStripe();
  const paymentIntentId = paymentIntentIdFromClientSecret(clientSecret);
  await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: "pm_card_ch",
    return_url: returnUrl,
  });
}
