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

async function selectCardTab(frame) {
  const cardTab = frame.getByRole("tab", { name: /^card$/i });
  if (await cardTab.isVisible().catch(() => false)) {
    await cardTab.click();
    await cardTab.waitFor({ state: "visible", timeout: 10_000 });
  }
}

async function typeStripeField(field, value) {
  await field.click();
  await field.fill("");
  await field.pressSequentially(value, { delay: 40 });
}

/** Wait until Stripe.js has mounted the Payment Element (iframe + Pay button). */
export async function waitForStripePaymentElement(page) {
  await page.getByTestId("event-checkout-pay").waitFor({
    state: "visible",
    timeout: 60_000,
  });

  const frame = page.frameLocator(PAYMENT_ELEMENT_FRAME).first();
  await selectCardTab(frame);

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

  await typeStripeField(
    frame.getByPlaceholder(/1234|card number/i),
    card.number,
  );
  await typeStripeField(frame.getByPlaceholder(/MM|expir/i), card.exp);
  await typeStripeField(
    frame.getByPlaceholder(/CVC|cvc|security code/i),
    card.cvc,
  );
}
