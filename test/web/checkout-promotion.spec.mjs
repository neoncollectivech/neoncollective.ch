import { test, expect } from "@playwright/test";

import {
  assertCheckoutTotalChf,
  clickContinueAndExpectIntent,
  completeFreePromoCheckout,
  createIsolatedContext,
  expectMinimalCheckout,
  loadE2eSeed,
  openInviteOnlyDossier,
  selectRootAndAddons,
  signInWithPhone,
} from "../fixtures/index.mjs";

test.describe.configure({ mode: "serial" });

test.describe("promotion free checkout", () => {
  const state = { seed: null, page: null, context: null };

  test.beforeAll(() => {
    state.seed = loadE2eSeed();
  });

  test.afterAll(async () => {
    await state.context?.close();
  });

  test("signs in and opens dossier with promo in URL", async ({ browser }) => {
    const isolated = await createIsolatedContext(browser);
    state.context = isolated.context;
    state.page = isolated.page;

    const cookiesBefore = await state.context.cookies();
    expect(cookiesBefore.some((c) => c.name === "neon_ev_participant")).toBe(
      false,
    );

    await state.page.goto(state.seed.freePromoUrl);
    await signInWithPhone(state.page, state.seed.hostInvitedPromo.phone);
    await openInviteOnlyDossier(
      state.page,
      state.seed,
      undefined,
      state.seed.freePromoUrl,
    );
  });

  test("with all tiers, promo prices cart at Addon 2 only", async () => {
    await selectRootAndAddons(state.page, state.seed, [
      state.seed.addon1TierName,
      state.seed.addon2TierName,
    ]);

    await clickContinueAndExpectIntent(state.page, state.seed, {
      expectPromotionCode: state.seed.promoCode,
      expectAmountCents: state.seed.promoAllTiersTotalCents,
      expectRequiresPayment: true,
    });

    await assertCheckoutTotalChf(state.page, state.seed.promoAllTiersTotalChf, {
      count: 1,
    });
  });

  test("reloads dossier for free Root + Addon 1 checkout", async () => {
    await state.page.goto(state.seed.freePromoUrl);
    await state.page.waitForURL(/\/events\/private/, { timeout: 30_000 });
    await state.page
      .getByTestId("event-checkout-confirm-contribution")
      .waitFor({ timeout: 60_000 });
  });

  test("checks out Root + Addon 1 for free", async () => {
    await selectRootAndAddons(state.page, state.seed, [
      state.seed.addon1TierName,
    ]);
    await expectMinimalCheckout(state.page, state.seed);
    await completeFreePromoCheckout(state.page, state.seed);
  });
});
