import { expect } from "@playwright/test";

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

function paymentElementFrame(page) {
  return page.frameLocator(PAYMENT_ELEMENT_FRAME).first();
}

function stripeCardFields(frame) {
  return {
    cardNumber: frame.getByPlaceholder(/1234|card number/i),
    expiry: frame.getByPlaceholder(/MM|expir/i),
    cvc: frame.getByPlaceholder(/CVC|cvc|security code/i),
  };
}

async function selectCardTab(frame) {
  const cardTab = frame.getByRole("tab", { name: /^card$/i });
  if (await cardTab.isVisible().catch(() => false)) {
    await cardTab.click();
    await expect(cardTab).toBeVisible({ timeout: 10_000 });
  }
}

/** Card tab selected and number / expiry / CVC inputs visible and editable. */
async function waitForStripeCardForm(frame) {
  await selectCardTab(frame);

  const fields = stripeCardFields(frame);

  for (const field of Object.values(fields)) {
    await field.waitFor({ state: "visible", timeout: 60_000 });
    await expect(field).toBeEditable({ timeout: 30_000 });
  }

  return fields;
}

async function fillStripeField(field, value) {
  await field.click();
  await field.fill(value);
}

/** Wait until Stripe.js has mounted the Payment Element (iframe + card form + Pay button). */
export async function waitForStripePaymentElement(page) {
  await page
    .getByTestId("event-checkout-payment-step")
    .waitFor({ state: "visible", timeout: 60_000 });

  await page.locator(PAYMENT_ELEMENT_FRAME).first().waitFor({
    state: "attached",
    timeout: 60_000,
  });

  const frame = paymentElementFrame(page);
  await waitForStripeCardForm(frame);

  await expect(page.getByTestId("event-checkout-pay")).toBeVisible({
    timeout: 30_000,
  });

  return frame;
}

/** Fill card fields after the Payment Element form is interactive. */
export async function fillStripePaymentElementFields(
  page,
  card = STRIPE_CHF_SUCCESS_CARD,
) {
  await page.locator(PAYMENT_ELEMENT_FRAME).first().waitFor({
    state: "attached",
    timeout: 60_000,
  });

  const frame = paymentElementFrame(page);
  const fields = await waitForStripeCardForm(frame);

  await fillStripeField(fields.cardNumber, card.number);
  await fillStripeField(fields.expiry, card.exp);
  await fillStripeField(fields.cvc, card.cvc);
}

/** Fill Stripe Payment Element fields (iframe) with the CH success test card. */
export async function fillStripePaymentElement(
  page,
  card = STRIPE_CHF_SUCCESS_CARD,
) {
  await waitForStripePaymentElement(page);
  await fillStripePaymentElementFields(page, card);
}
