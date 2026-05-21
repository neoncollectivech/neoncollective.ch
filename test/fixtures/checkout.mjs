import { expect } from "@playwright/test";

import { fillStripePaymentElement } from "./stripe-confirm.mjs";

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

export async function completeEventCheckout(page, seed) {
  const intentResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/checkout/intent") &&
      res.request().method() === "POST" &&
      res.status() === 200,
  );

  await page.getByRole("button", { name: "Continue to payment" }).click();

  const response = await intentResponse;
  const body = await response.json();
  if (!body.clientSecret || !body.orderId) {
    throw new Error("Checkout intent response missing clientSecret or orderId.");
  }

  if (seed?.addonTierName) {
    const posted = response.request().postDataJSON();
    const addonIds = posted?.addonTierIds ?? [];
    if (!Array.isArray(addonIds) || addonIds.length === 0) {
      throw new Error("Checkout intent did not include addon tier ids.");
    }
  }

  await fillStripePaymentElement(page);
  await page.getByTestId("event-checkout-pay").click();
  await page.getByRole("heading", { name: "You're registered" }).waitFor({
    timeout: 60_000,
  });
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
