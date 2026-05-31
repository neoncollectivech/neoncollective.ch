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

/** Pending aside after pay/intent, or success when fulfillment is instant. */
export async function expectCheckoutConfirmingOrRegistered(page, timeout = 60_000) {
  const confirming = page
    .getByTestId("event-checkout-confirming")
    .or(page.getByRole("heading", { name: "You're registered" }));
  const paymentError = page.getByTestId("event-checkout-payment-error");

  await expect(async () => {
    if (await paymentError.isVisible().catch(() => false)) {
      throw new Error(
        `Stripe payment error: ${(await paymentError.innerText()).trim()}`,
      );
    }
    await expect(confirming).toBeVisible();
  }).toPass({ timeout });
}

/** Click the contribution CTA (stable test id; main panel, not sticky bar). */
export async function clickConfirmContribution(page) {
  await page.getByTestId("event-checkout-confirm-contribution").first().click();
}

/** Tier picker for a signed-in user with a complete profile — no contact fields or sign-in panel. */
export async function expectMinimalCheckout(page, seed) {
  await expect(page.getByTestId("event-checkout-minimal")).toBeVisible();
  await expect(page.getByTestId("event-checkout-contact-form")).not.toBeVisible();
  await expect(page.getByTestId("event-checkout-with-contact")).not.toBeVisible();
  await expect(page.getByText("Enter your email or phone to continue")).not.toBeVisible();
  await expect(page.getByTestId("event-checkout-confirm-contribution")).toBeVisible();

  if (seed?.addon1TierName ?? seed?.addonTierName) {
    await expect(page.getByText("Optional extras", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("checkbox", {
        name: new RegExp(seed.addon1TierName ?? seed.addonTierName, "i"),
      }),
    ).toBeVisible();
  }
  if (seed?.addon2TierName) {
    await expect(
      page.getByRole("checkbox", { name: new RegExp(seed.addon2TierName, "i") }),
    ).toBeVisible();
  }
}

export async function assertCheckoutTotalChf(page, totalChf, opts = {}) {
  const totalLabel = `Your contribution: CHF ${totalChf}`;
  const totals = page.getByText(totalLabel);
  const expectedCount = opts.count;

  if (expectedCount != null) {
    await expect(totals).toHaveCount(expectedCount);
    return;
  }

  // Total is shown once in the contribution summary (desktop); sticky bar is mobile-only.
  await expect(totals.first()).toBeVisible();
}

/** Select Root (exclusive) and one or more add-ons by tier name. */
export async function selectRootAndAddons(page, seed, addonTierNames) {
  const rootName = seed.rootTierName ?? seed.exclusiveTierName;
  const root = page.getByRole("radio", { name: new RegExp(rootName, "i") });
  await root.waitFor({ state: "visible", timeout: 30_000 });
  await root.check();

  for (const addonName of addonTierNames) {
    const addon = page.getByRole("checkbox", { name: new RegExp(addonName, "i") });
    await addon.waitFor({ state: "visible", timeout: 30_000 });
    await addon.check();
  }
}

/** Select Root + Addon 1 (invite paid checkout). */
export async function selectExclusiveAndAddon(page, seed, opts = {}) {
  const addon1 = seed.addon1TierName ?? seed.addonTierName;
  await selectRootAndAddons(page, seed, [addon1]);

  const expectedTotal = opts.expectTotalChf ?? seed.checkoutTotalChf;
  if (expectedTotal != null) {
    await assertCheckoutTotalChf(page, expectedTotal);
  }
}

/**
 * Click Continue to payment and assert checkout intent pricing (no Stripe wait).
 */
export async function clickContinueAndExpectIntent(page, seed, opts = {}) {
  const returnPath = checkoutReturnPathFromPage(page);
  const intentResponse = page.waitForResponse(isCheckoutIntentResponse, {
    timeout: 60_000,
  });

  await clickConfirmContribution(page);

  const response = await intentResponse;
  const body = await response.json();
  const posted = response.request().postDataJSON();

  assertCheckoutIntentRequest(posted, returnPath, seed, {
    expectPromotionCode:
      opts.expectPromotionCode !== undefined
        ? opts.expectPromotionCode
        : undefined,
  });

  if (opts.expectAmountCents != null && body.amountCents !== opts.expectAmountCents) {
    throw new Error(
      `Checkout intent amountCents mismatch: expected ${opts.expectAmountCents}, got ${body.amountCents}.`,
    );
  }
  if (
    opts.expectRequiresPayment != null &&
    body.requiresPayment !== opts.expectRequiresPayment
  ) {
    throw new Error(
      `Checkout intent requiresPayment mismatch: expected ${opts.expectRequiresPayment}, got ${body.requiresPayment}.`,
    );
  }

  if (!body.orderId || !body.returnUrl) {
    throw new Error("Checkout intent response missing orderId or returnUrl.");
  }

  if (opts.expectAmountCents === 0 || body.requiresPayment === false) {
    assertCheckoutIntentResponse(body, returnPath);
  } else if (!body.clientSecret) {
    throw new Error("Paid checkout intent response missing clientSecret.");
  }

  return { body, posted, returnPath };
}

/** Invite-only dossier (private route). Required after sign-in — bare private URL redirects to /events without a session. */
export async function openInviteOnlyDossier(page, seed, inviteToken, dossierUrl) {
  const url = new URL(dossierUrl ?? seed.privateUrl);
  if (inviteToken) {
    url.searchParams.set("invite", inviteToken);
  }
  await page.goto(url.toString());
  await page.waitForURL(/\/events\/private/, { timeout: 30_000 });
  await page
    .getByTestId("event-checkout-confirm-contribution")
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

function assertCheckoutIntentRequest(posted, returnPath, seed, opts = {}) {
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
  if (opts.expectPromotionCode !== undefined) {
    const expected = opts.expectPromotionCode;
    const actual = posted.promotionCode ?? null;
    if (actual !== expected) {
      throw new Error(
        `Checkout intent promotionCode mismatch: expected ${expected ?? "(none)"}, got ${actual ?? "(missing)"}`,
      );
    }
  }
}

function assertCheckoutIntentResponse(body, returnPath) {
  if (!body.orderId || !body.returnUrl) {
    throw new Error("Checkout intent response missing orderId or returnUrl.");
  }
  const returnUrl = String(body.returnUrl);
  if (!returnUrl.includes(returnPath.split("?")[0])) {
    throw new Error(
      `Checkout intent returnUrl does not include dossier path: ${returnUrl}`,
    );
  }
  if (body.requiresPayment === false) {
    if (body.amountCents !== 0) {
      throw new Error(
        `Free checkout intent expected amountCents 0, got ${body.amountCents}.`,
      );
    }
    if (body.clientSecret) {
      throw new Error("Free checkout intent must not return clientSecret.");
    }
    return;
  }
  if (!body.clientSecret) {
    throw new Error(
      "Paid checkout intent response missing clientSecret.",
    );
  }
}

/**
 * Click “Continue to payment”, wait for intent + Stripe Payment Element — same as production before Pay.
 */
export async function startCheckoutPaymentStep(page, seed, opts = {}) {
  const returnPath = checkoutReturnPathFromPage(page);
  const intentResponse = page.waitForResponse(isCheckoutIntentResponse, {
    timeout: 60_000,
  });

  await clickConfirmContribution(page);

  const response = await intentResponse;
  const body = await response.json();
  const posted = response.request().postDataJSON();

  assertCheckoutIntentRequest(posted, returnPath, seed, opts);
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

  const payButton = page.getByTestId("event-checkout-pay");
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

  await expectCheckoutConfirmingOrRegistered(page);

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

/**
 * Promo checkout with zero total: intent → confirm API → registration poll (no Stripe).
 */
export async function completeFreePromoCheckout(page, seed) {
  const returnPath = checkoutReturnPathFromPage(page);
  const intentResponse = page.waitForResponse(isCheckoutIntentResponse, {
    timeout: 60_000,
  });
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

  await clickConfirmContribution(page);

  const response = await intentResponse;
  const body = await response.json();
  const posted = response.request().postDataJSON();

  assertCheckoutIntentRequest(posted, returnPath, seed, {
    expectPromotionCode: seed.promoCode ?? null,
  });
  assertCheckoutIntentResponse(body, returnPath);

  await expectCheckoutConfirmingOrRegistered(page);

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

/** Guest invite link budget from `GET /invites/resolve` (counts pending + paid orders). */
export async function fetchInviteRemainingRedemptions(request, eventsApiBase, inviteUrl) {
  const token = new URL(inviteUrl).searchParams.get("invite");
  if (!token) {
    throw new Error(`Invite URL missing ?invite= param: ${inviteUrl}`);
  }
  const res = await request.get(
    `${eventsApiBase}/invites/resolve?token=${encodeURIComponent(token)}`,
  );
  if (!res.ok()) {
    throw new Error(
      `Invite resolve failed (${res.status()}): ${await res.text()}`,
    );
  }
  const body = await res.json();
  if (typeof body.remainingRedemptions !== "number") {
    throw new Error(
      `Invite resolve missing remainingRedemptions: ${JSON.stringify(body)}`,
    );
  }
  return body.remainingRedemptions;
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
