import { test, expect } from "@playwright/test";

import { loadE2eSeed } from "../fixtures/index.mjs";

test.describe("invite-only gate (unauthenticated)", () => {
  test("shows gate only — title yes, dossier fields hidden", async ({
    browser,
  }) => {
    const seed = loadE2eSeed();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(seed.privateUrl);

    await expect(page.getByTestId("invite-only-empty-state")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /\[E2E\] Invite-only checkout/i,
    );

    await expect(page.getByText("Test", { exact: true })).not.toBeVisible();
    await expect(
      page.getByText("Playwright checkout flow seed."),
    ).not.toBeVisible();
    await expect(page.getByTestId("event-checkout-confirm-contribution")).not.toBeVisible();

    const backLinks = page.getByRole("link", { name: /back to events/i });
    await expect(backLinks).toHaveCount(1);

    await expect(page.getByTestId("participant-session-contact")).toBeVisible();

    await context.close();
  });
});
