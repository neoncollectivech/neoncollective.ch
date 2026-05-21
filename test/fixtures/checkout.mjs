import { expect } from "@playwright/test";

import {
  fillStripePaymentElement,
  waitForStripePaymentElement,
} from "./stripe-payment-element.mjs";

/** Current dossier path + query — matches `detailReturnPath` sent to checkout intent. */
export function checkoutReturnPathFromPage(page) {
  const url = new URL(page.url());

  return url.pathname + url.search;
}

/** Tier picker only — no inline email/phone and no sign-in panel under checkout. */
export async function expectMinimalCheckout(page, seed) {
  await expect(page.getByTestId("event-checkout-minimal")).toBeVisible();
  await expect(page.getByTestId("event-checkout-contact-form")).not.toBeVisible();
  await expect(page.getByTestId("event-checkout-with-contact")).not.toBeVisible();
  await expect(page.getByText("Enter your email or phone to continue")).not.toBeVisible();
  await expect(page.getByText(/Welcome back/i)).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to payment" }),
  ).toBeVisible();

  if (seed?.addonTierName) {
    await expect(page.getByText("Add-ons", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: new RegExp(seed.addonTierName, "i") }),
    ).toBeVisible();
  }
}

/** Select one exclusive tier and the seeded add-on; assert checkout total. */
export async function selectExclusiveAndAddon(page, seed) {
  const exclusive = page.getByRole("radio", {
    name: new RegExp(seed.exclusiveTierName, "i"),
  });
  await exclusive.waitFor({ state: "visible", timeout: 30_000 });
  await exclusive.check();

  const addon = page.getByRole("checkbox", {
    name: new RegExp(seed.addonTierName, "i"),
  });
  await addon.waitFor({ state: "visible", timeout: 30_000 });
  await addon.check();

  await expect(
    page.getByText(`Total: CHF ${seed.checkoutTotalChf}`),
  ).toBeVisible();
}

/** Invite-only dossier (private route). Required after sign-in — bare private URL redirects to /events without a session. */
export async function openInviteOnlyDossier(page, seed, inviteToken) {
  const url = new URL(seed.privateUrl);
  if (inviteToken) {
    url.searchParams.set("invite", inviteToken);
  }
  await page.goto(url.toString());
  await page.waitForURL(/\/events\/private/, { timeout: 30_000 });
  await page
    .getByRole("button", { name: "Continue to payment" })
    .waitFor({ timeout: 60_000 });
}

/** After profile on the events index (?invite=), open the private checkout page. */
export async function openInviteOnlyDossierFromIndex(page, seed, inviteUrl) {
  const inviteToken = new URL(inviteUrl).searchParams.get("invite");
  await openInviteOnlyDossier(page, seed, inviteToken ?? undefined);
}

function isCheckoutIntentResponse(res) {
  return (
    res.url().includes("/checkout/intent") &&
    res.request().method() === "POST" &&
    res.status() === 200
  );
}

function isCheckoutConfirmResponse(res) {
  return (
    res.url().includes("/checkout/confirm") &&
    res.request().method() === "POST" &&
    res.status() === 200
  );
}

function assertCheckoutIntentRequest(posted, returnPath, seed) {
  if (posted.returnPath !== returnPath) {
    throw new Error(
      `Checkout intent returnPath mismatch: expected ${returnPath}, got ${posted.returnPath ?? "(missing)"}`,
    );
  }
  if (!posted.exclusiveTierId) {
    throw new Error("Checkout intent did not include exclusiveTierId.");
  }
  if (seed?.addonTierName) {
    const addonIds = posted?.addonTierIds ?? [];
    if (!Array.isArray(addonIds) || addonIds.length === 0) {
      throw new Error("Checkout intent did not include addon tier ids.");
    }
  }
}

function assertCheckoutIntentResponse(body, returnPath) {
  if (!body.clientSecret || !body.orderId || !body.returnUrl) {
    throw new Error(
      "Checkout intent response missing clientSecret, orderId, or returnUrl.",
    );
  }
  const returnUrl = String(body.returnUrl);
  if (!returnUrl.includes(returnPath.split("?")[0])) {
    throw new Error(
      `Checkout intent returnUrl does not include dossier path: ${returnUrl}`,
    );
  }
}

/**
 * Click “Continue to payment”, wait for intent + Stripe Payment Element — same as production before Pay.
 */
export async function startCheckoutPaymentStep(page, seed) {
  const returnPath = checkoutReturnPathFromPage(page);
  const intentResponse = page.waitForResponse(isCheckoutIntentResponse, {
    timeout: 60_000,
  });

  await page.getByRole("button", { name: "Continue to payment" }).click();

  const response = await intentResponse;
  const body = await response.json();
  const posted = response.request().postDataJSON();

  assertCheckoutIntentRequest(posted, returnPath, seed);
  assertCheckoutIntentResponse(body, returnPath);

  await waitForStripePaymentElement(page);

  return {
    orderId: body.orderId,
    clientSecret: body.clientSecret,
    returnUrl: body.returnUrl,
    returnPath,
  };
}

/**
 * Fill the Payment Element, click Pay (browser `stripe.confirmPayment`), then wait for
 * POST /checkout/confirm and event registration poll — mirrors `useCheckoutConfirmation`.
 */
export async function submitStripePaymentAndConfirmRegistration(page, seed) {
  await fillStripePaymentElement(page);

  const payButton = page.getByRole("button", { name: "Pay now" });
  await expect(payButton).toBeEnabled({ timeout: 30_000 });

  const confirmResponse = page.waitForResponse(isCheckoutConfirmResponse, {
    timeout: 90_000,
  });

  const registrationResponse = page.waitForResponse(
    async (res) => {
      if (!res.url().includes(`/events/${seed.slug}`)) {
        return false;
      }
      if (res.request().method() !== "GET" || !res.ok()) {
        return false;
      }
      try {
        const json = await res.json();

        return json.registrationConfirmed === true;
      } catch {
        return false;
      }
    },
    { timeout: 90_000 },
  );

  await payButton.click();

  await expect(
    page.getByText("Confirming your payment…"),
  ).toBeVisible({ timeout: 20_000 });

  const confirmRes = await confirmResponse;
  const confirmBody = await confirmRes.json();
  if (!confirmBody.ok) {
    throw new Error("Checkout confirm response missing ok: true.");
  }

  await registrationResponse;

  await expect(
    page.getByRole("heading", { name: "You're registered" }),
  ).toBeVisible({ timeout: 30_000 });
}

/** Full production-like checkout: intent → Elements → Pay → confirm API → registration poll. */
export async function completeEventCheckout(page, seed) {
  await startCheckoutPaymentStep(page, seed);
  await submitStripePaymentAndConfirmRegistration(page, seed);
}

export async function extractInviteUrlFromPage(page) {
  const text = await page.locator("text=/invite=/").first().textContent();
  const raw = text?.trim() ?? "";
  const match = raw.match(/https?:\/\/[^\s]+invite=[^\s]+/);
  if (!match) {
    throw new Error(`Could not find invite URL on page: ${raw}`);
  }
  return match[0];
}
