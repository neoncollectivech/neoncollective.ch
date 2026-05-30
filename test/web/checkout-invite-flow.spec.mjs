import { test, expect } from "@playwright/test";

import {
  clickContinueAndExpectIntent,
  completeEventCheckout,
  completeProfileWithPhone,
  createIsolatedContext,
  expectMinimalCheckout,
  extractInviteUrlFromPage,
  loadE2eSeed,
  openInviteOnlyDossier,
  openInviteOnlyDossierFromIndex,
  expectHostInviteConversion,
  expectHostInviteConversionApi,
  fetchInviteRemainingRedemptions,
  selectExclusiveAndAddon,
  signInWithPhone,
  startCheckoutPaymentStep,
  submitStripePaymentAndConfirmRegistration,
  waitForStripePaymentElement,
} from "../fixtures/index.mjs";

const EVENTS_API =
  process.env.NEXT_PUBLIC_EVENTS_API_URL?.trim() || "http://localhost:8082";

test.describe.configure({ mode: "serial" });

test.describe("invite-only checkout", () => {
  const state = {
    seed: null,
    inviteUrl: "",
    contextA: null,
    pageA: null,
    contextB: null,
    pageB: null,
    requestB: null,
  };

  test.beforeAll(() => {
    state.seed = loadE2eSeed();
  });

  test.afterAll(async () => {
    await state.contextA?.close();
    await state.contextB?.close();
  });

  test.describe("Person A (host on guest list)", () => {
    test("signs in with phone", async ({ browser }) => {
      state.contextA = await browser.newContext();
      state.pageA = await state.contextA.newPage();

      await state.pageA.goto(state.seed.privateUrl);
      await signInWithPhone(state.pageA, state.seed.hostInvited.phone);
    });

    test("sees minimal checkout with exclusive and add-on tiers", async () => {
      await openInviteOnlyDossier(state.pageA, state.seed);
      await expectMinimalCheckout(state.pageA, state.seed);
    });

    test("selects Root and Addon 1", async () => {
      await selectExclusiveAndAddon(state.pageA, state.seed);
    });

    test("pays with Stripe Payment Element and confirms registration", async () => {
      await completeEventCheckout(state.pageA, state.seed);
    });

    test("sees host invite link", async () => {
      await expect(state.pageA.getByText("Bring your friends")).toBeVisible();
      state.inviteUrl = await extractInviteUrlFromPage(state.pageA);
      expect(state.inviteUrl).toContain("invite=");
    });
  });

  test.describe("Person B (guest via host link)", () => {
    test("starts in a fresh browser without session cookie", async ({
      browser,
    }) => {
      const isolated = await createIsolatedContext(browser);
      state.contextB = isolated.context;
      state.pageB = isolated.page;
      state.requestB = isolated.request;

      const cookiesBefore = await state.contextB.cookies();
      expect(cookiesBefore.some((c) => c.name === "neon_ev_participant")).toBe(
        false,
      );
    });

    test("opens host invite link and completes profile", async () => {
      await state.pageB.goto(state.inviteUrl);
      await state.pageB.getByTestId("participant-profile-given-name").waitFor({
        timeout: 30_000,
      });
      await completeProfileWithPhone(state.pageB, {
        givenName: state.seed.guestInvited.givenName,
        familyName: state.seed.guestInvited.familyName,
        phone: state.seed.guestInvited.phone,
      });
    });

    test("sees minimal checkout with exclusive and add-on tiers", async () => {
      if (!state.pageB.url().includes("/events/private")) {
        await openInviteOnlyDossierFromIndex(
          state.pageB,
          state.seed,
          state.inviteUrl,
        );
      } else {
        await state.pageB
          .getByRole("button", { name: "Continue to payment" })
          .waitFor({ timeout: 60_000 });
      }
      await expectMinimalCheckout(state.pageB, state.seed);
    });

    test("selects Root and Addon 1", async () => {
      await selectExclusiveAndAddon(state.pageB, state.seed);
    });

    test("can retry checkout after abandoning a pending payment", async () => {
      await startCheckoutPaymentStep(state.pageB, state.seed);

      const remainingAfterAbandon = await fetchInviteRemainingRedemptions(
        state.requestB,
        EVENTS_API,
        state.inviteUrl,
      );
      expect(remainingAfterAbandon).toBe(0);

      await openInviteOnlyDossierFromIndex(
        state.pageB,
        state.seed,
        state.inviteUrl,
      );
      await selectExclusiveAndAddon(state.pageB, state.seed);
      await clickContinueAndExpectIntent(state.pageB, state.seed, {
        expectRequiresPayment: true,
        expectAmountCents: state.seed.checkoutTotalCents,
      });
    });

    test("pays with Stripe Payment Element and confirms registration", async () => {
      // Abandon/retry test leaves the payment step open — do not click Continue again.
      await waitForStripePaymentElement(state.pageB);
      await submitStripePaymentAndConfirmRegistration(state.pageB, state.seed);
      await expect(state.pageB.getByText("Bring your friends")).not.toBeVisible();
    });

    test("API detail has no hostInvite", async () => {
      const detailRes = await state.requestB.get(
        `${EVENTS_API}/events/${state.seed.slug}`,
      );
      expect(detailRes.ok()).toBeTruthy();
      const detail = await detailRes.json();
      expect(detail.registrationConfirmed).toBe(true);
      expect(detail.hostInvite).toBeUndefined();

      await state.contextB.close();
      state.contextB = null;
      state.pageB = null;
      state.requestB = null;
    });
  });

  test.describe("Person A sees Person B on host invite list", () => {
    test("event details UI lists guest conversion", async () => {
      await state.pageA.goto(state.seed.privateUrl);
      await expect(
        state.pageA.getByRole("heading", { name: "You're registered" }),
      ).toBeVisible();
      await expectHostInviteConversion(state.pageA, state.seed);
    });

    test("events API hostInvite includes guest conversion", async () => {
      const detailRes = await state.contextA.request.get(
        `${EVENTS_API}/events/${state.seed.slug}`,
      );
      expect(detailRes.ok()).toBeTruthy();
      expectHostInviteConversionApi(await detailRes.json(), state.seed);

      await state.contextA.close();
      state.contextA = null;
      state.pageA = null;
    });
  });
});
