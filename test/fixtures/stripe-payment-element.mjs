import { expect } from "@playwright/test";

/**
 * Stripe Visa test PAN for Switzerland (CH) — succeeds with CHF PaymentIntents.
 * Kept for manual / card-tab debugging; checkout E2E uses TWINT by default.
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

async function selectTwintTab(frame) {
  const twintTab = frame.getByRole("tab", { name: /^twint$/i });
  if (await twintTab.isVisible().catch(() => false)) {
    await twintTab.click();
  }
}

/** TWINT tab selected (or only method) and Pay is available — no card fields to fill. */
async function waitForStripeTwintReady(frame, page) {
  await selectTwintTab(frame);

  await expect(page.getByTestId("event-checkout-pay")).toBeVisible({
    timeout: 30_000,
  });
}

function isStripeTwintTestRedirectUrl(href) {
  if (href.includes("redirect_status=succeeded")) {
    return true;
  }
  try {
    const { hostname, pathname } = new URL(href);
    if (hostname === "hooks.stripe.com") {
      return true;
    }
    if (
      hostname === "payments.stripe.com" &&
      pathname.includes("/payment_methods/test_payment")
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function twintTestAuthorizeControl(page) {
  return page
    .locator("#authorize-test-payment")
    .or(page.getByRole("link", { name: /authorize test payment/i }))
    .or(page.getByRole("button", { name: /authorize test payment/i }))
    .first();
}

/**
 * Stripe test-mode redirect after TWINT Pay (`payments.stripe.com/.../test_payment`
 * or legacy `hooks.stripe.com`) — click Authorize, then wait for dossier return.
 * @see https://docs.stripe.com/payments/twint/accept-a-payment#test-twint-integration
 */
export async function authorizeStripeTwintTestRedirect(page, opts = {}) {
  const timeout = opts.timeout ?? 90_000;

  await page.waitForURL((url) => isStripeTwintTestRedirectUrl(url.href), {
    timeout,
  });

  if (!page.url().includes("redirect_status=succeeded")) {
    const authorize = twintTestAuthorizeControl(page);
    await authorize.waitFor({ state: "visible", timeout });
    await authorize.click();
  }

  await page.waitForURL(/redirect_status=succeeded/, { timeout });
}

/** Wait until Stripe.js has mounted the Payment Element with TWINT ready. */
export async function waitForStripePaymentElement(page) {
  await page
    .getByTestId("event-checkout-payment-step")
    .waitFor({ state: "visible", timeout: 60_000 });

  await page.locator(PAYMENT_ELEMENT_FRAME).first().waitFor({
    state: "attached",
    timeout: 60_000,
  });

  const frame = paymentElementFrame(page);
  await waitForStripeTwintReady(frame, page);

  return frame;
}

/** Ensure TWINT is selected when the payment step is already open. */
export async function ensureTwintPaymentMethodSelected(page) {
  await page.locator(PAYMENT_ELEMENT_FRAME).first().waitFor({
    state: "attached",
    timeout: 60_000,
  });
  const frame = paymentElementFrame(page);
  await waitForStripeTwintReady(frame, page);
}

/** TWINT needs no fields — only confirms the tab/method is ready. */
export async function fillStripePaymentElementFields(page) {
  await ensureTwintPaymentMethodSelected(page);
}

/** Open payment step and prepare TWINT (default method). */
export async function fillStripePaymentElement(page) {
  await waitForStripePaymentElement(page);
  await fillStripePaymentElementFields(page);
}
