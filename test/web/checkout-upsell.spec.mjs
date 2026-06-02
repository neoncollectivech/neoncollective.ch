import { expect, test } from "@playwright/test";

import {
  completeEventCheckout,
  loadE2eSeed,
  openInviteOnlyDossier,
  selectExclusiveAndAddon,
  signInWithPhone,
  submitStripePaymentAndConfirmRegistration,
  waitForStripePaymentElement,
} from "../fixtures/index.mjs";

test.describe("checkout upsell", () => {
  test("registered participant can buy remaining add-on once", async ({ page }) => {
    const seed = loadE2eSeed();

    await page.goto(seed.privateUrl);
    await signInWithPhone(page, seed.upsellInvited.phone);
    await openInviteOnlyDossier(page, seed);
    await selectExclusiveAndAddon(page, seed);
    await completeEventCheckout(page, seed);

    await expect(
      page.getByRole("heading", { name: "You're registered" }),
    ).toBeVisible();
    await expect(page.getByText("Extend your contribution")).toBeVisible();

    await page.getByText("Extend your contribution").click();

    await expect(
      page.getByRole("checkbox", { name: new RegExp(seed.addon2TierName, "i") }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: new RegExp(seed.addon1TierName, "i") }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: new RegExp(seed.rootTierName, "i") }),
    ).toHaveCount(0);

    const intentResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/checkout/intent") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 60_000 },
    );

    await page
      .getByRole("checkbox", { name: new RegExp(seed.addon2TierName, "i") })
      .check();
    await page.getByTestId("event-checkout-confirm-contribution").first().click();

    const intentRes = await intentResponse;
    const intent = await intentRes.json();
    const posted = intentRes.request().postDataJSON();
    expect(posted.exclusiveTierId).toBe("");
    expect(posted.addonTierIds).toEqual([seed.addon2Id]);
    expect(intent.requiresPayment).toBe(true);
    expect(intent.amountCents).toBe(seed.addon2TierCents);

    await waitForStripePaymentElement(page);
    await submitStripePaymentAndConfirmRegistration(page, seed, {
      paymentElementReady: true,
    });

    await expect(page.getByText("Extend your contribution")).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: new RegExp(seed.addon2TierName, "i") }),
    ).toHaveCount(0);
  });
});
