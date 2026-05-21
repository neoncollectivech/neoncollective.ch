export { loadE2eSeed } from "./seed.mjs";
export { E2E_OTP, signInWithPhone, completeProfileWithPhone } from "./participant-auth.mjs";
export {
  checkoutReturnPathFromPage,
  completeEventCheckout,
  expectMinimalCheckout,
  extractInviteUrlFromPage,
  openInviteOnlyDossier,
  openInviteOnlyDossierFromIndex,
  selectExclusiveAndAddon,
  startCheckoutPaymentStep,
  submitStripePaymentAndConfirmRegistration,
} from "./checkout.mjs";
export {
  expectHostInviteConversion,
  expectHostInviteConversionApi,
} from "./host-invite.mjs";
export {
  fillStripePaymentElement,
  STRIPE_CHF_SUCCESS_CARD,
  waitForStripePaymentElement,
} from "./stripe-payment-element.mjs";

export async function createIsolatedContext(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page, request: context.request };
}
