/**
 * Stripe Visa test PAN for Switzerland (CH) — succeeds with CHF PaymentIntents.
 * @see https://docs.stripe.com/testing#international-cards
 */
export const STRIPE_CHF_SUCCESS_CARD = {
  number: "4000007560000009",
  exp: "12 / 34",
  cvc: "123",
};

const PAYMENT_ELEMENT_FRAME =
  'iframe[title*="Secure payment input frame"], iframe[src*="js.stripe.com"]';

/** Wait until Stripe.js has mounted the Payment Element (iframe + Pay button). */
export async function waitForStripePaymentElement(page) {
  await page.getByTestId("event-checkout-pay").waitFor({
    state: "visible",
    timeout: 60_000,
  });

  const frame = page.frameLocator(PAYMENT_ELEMENT_FRAME).first();
  const cardNumber = frame.getByPlaceholder(/1234|card number/i);
  await cardNumber.waitFor({ state: "visible", timeout: 60_000 });

  return frame;
}

/** Fill Stripe Payment Element fields (iframe) with the CH success test card. */
export async function fillStripePaymentElement(
  page,
  card = STRIPE_CHF_SUCCESS_CARD,
) {
  const frame = await waitForStripePaymentElement(page);

  const cardNumber = frame.getByPlaceholder(/1234|card number/i);
  await cardNumber.fill(card.number);

  const expiry = frame.getByPlaceholder(/MM|expir/i);
  await expiry.fill(card.exp);

  const cvc = frame.getByPlaceholder(/CVC|cvc|security code/i);
  await cvc.fill(card.cvc);
}
