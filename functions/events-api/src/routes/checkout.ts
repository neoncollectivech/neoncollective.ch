import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  checkoutConfirmSchema,
  checkoutIntentSchema,
  checkoutPricingPreviewSchema,
} from "../schemas";
import { confirmPaidCheckout, type ConfirmPaidCheckoutFailureReason } from "./checkout/confirm";
import {
  createCheckoutIntent,
  type CreateCheckoutIntentFailureReason,
} from "./checkout/intent";
import {
  previewCheckoutPricing,
  type CheckoutPricingPreviewFailureReason,
} from "./checkout/pricing-preview";
import { resolveParticipantSessionFromCookie } from "./registrations/session";
import { databaseUnavailableResponse, requireDatabase } from "./shared/guards";
import { jsonReasonFailure } from "./shared/respond";

const CHECKOUT_INTENT_ERRORS: Record<
  CreateCheckoutIntentFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  not_authenticated: { status: 401, error: "Sign in and complete your profile first." },
  profile_incomplete: {
    status: 403,
    error: "Complete and verify your profile before checkout.",
  },
  profile_not_found: { status: 404, error: "Profile not found." },
  invalid_phone: { status: 400, error: "Invalid phone number." },
  event_not_found: { status: 404, error: "Event not found." },
  invalid_invite: { status: 403, error: "Invalid or expired invite." },
  contact_required: { status: 400, error: "Email or phone is required." },
  invitee_ambiguous: {
    status: 400,
    error: "Multiple event invite matches — contact the organizer.",
  },
  invite_only_denied: {
    status: 403,
    error: "This event is invite-only. Use your invite link or invited email.",
  },
  invite_exhausted: { status: 409, error: "This invite link has no remaining places." },
  tier_required: { status: 400, error: "Select a contribution tier." },
  tiers_required: { status: 400, error: "Select at least one tier." },
  unknown_tier: { status: 400, error: "Unknown or inactive tier." },
  invalid_exclusive_tier: { status: 400, error: "Invalid contribution tier." },
  invalid_addon_tier: { status: 400, error: "Invalid add-on tier." },
  event_sold_out: { status: 409, error: "This event is sold out." },
  tier_sold_out: { status: 409, error: "Not enough places remaining for this tier." },
  identity_conflict: {
    status: 409,
    error: "Contact details conflict with another profile.",
  },
  profile_mismatch: { status: 409, error: "Profile mismatch — refresh and try again." },
  already_registered: { status: 409, error: "You are already registered for this event." },
  payment_complete_refresh: {
    status: 409,
    error: "Your payment is complete. Refresh the page to see your confirmation.",
  },
  mixed_currency: { status: 400, error: "Selected tiers use different currencies." },
  invalid_promotion: { status: 400, error: "This promotion is not valid for this event." },
  promotion_exhausted: { status: 409, error: "This promotion has reached its usage limit." },
  checkout_failed: { status: 500, error: "Checkout failed." },
};

const CHECKOUT_PRICING_PREVIEW_ERRORS: Record<
  CheckoutPricingPreviewFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  event_not_found: { status: 404, error: "Event not found." },
  tier_required: { status: 400, error: "Select a contribution tier." },
  tiers_required: { status: 400, error: "Select at least one tier." },
  unknown_tier: { status: 400, error: "Unknown or inactive tier." },
  invalid_exclusive_tier: { status: 400, error: "Invalid contribution tier." },
  invalid_addon_tier: { status: 400, error: "Invalid add-on tier." },
  invalid_promotion: { status: 400, error: "This promotion is not valid for this event." },
  promotion_exhausted: { status: 409, error: "This promotion has reached its usage limit." },
};

const CHECKOUT_CONFIRM_ERRORS: Record<
  ConfirmPaidCheckoutFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  order_not_found: { status: 404, error: "Order not found." },
  order_forbidden: { status: 403, error: "This order does not belong to your session." },
  checkout_not_confirmable: {
    status: 409,
    error: "This checkout can no longer be confirmed.",
  },
  payment_not_started: { status: 400, error: "Payment has not been started for this order." },
  stripe_unavailable: { status: 502, error: "Could not verify payment with Stripe." },
  payment_incomplete: {
    status: 409,
    error: "Payment is not complete yet. Wait a moment and try again.",
  },
  payment_mismatch: { status: 500, error: "Payment does not match this order." },
  checkout_fulfillment_failed: {
    status: 500,
    error: "Payment succeeded but checkout could not be completed. Try again shortly.",
  },
};

export function createCheckoutRouter(): Hono {
  const router = new Hono();

  router.post("/checkout/intent", arktypeValidator("json", checkoutIntentSchema), async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    if (!session) {
      return c.json({ error: CHECKOUT_INTENT_ERRORS.not_authenticated.error }, 401);
    }
    const body = c.req.valid("json");
    const res = await createCheckoutIntent({
      slug: body.slug,
      email: body.email,
      locale: body.locale,
      phoneE164: body.phoneE164,
      inviteToken: body.inviteToken,
      exclusiveTierId: body.exclusiveTierId,
      addonTierIds: body.addonTierIds,
      returnPath: body.returnPath,
      promotionCode: body.promotionCode,
      session,
    });
    if (!res.ok) {
      return jsonReasonFailure(c, res, CHECKOUT_INTENT_ERRORS);
    }
    return c.json({
      orderId: res.orderId,
      returnUrl: res.returnUrl,
      requiresPayment: res.requiresPayment,
      amountCents: res.amountCents,
      ...(res.clientSecret ? { clientSecret: res.clientSecret } : {}),
    });
  });

  router.post(
    "/checkout/pricing-preview",
    arktypeValidator("json", checkoutPricingPreviewSchema),
    async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const body = c.req.valid("json");
      const res = await previewCheckoutPricing({
        slug: body.slug,
        exclusiveTierId: body.exclusiveTierId,
        addonTierIds: body.addonTierIds,
        promotionCode: body.promotionCode,
      });
      if (!res.ok) {
        return jsonReasonFailure(c, res, CHECKOUT_PRICING_PREVIEW_ERRORS);
      }
      return c.json({
        amountCents: res.amountCents,
        subtotalCents: res.subtotalCents,
        discountCents: res.discountCents,
      });
    },
  );

  router.post("/checkout/confirm", arktypeValidator("json", checkoutConfirmSchema), async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    if (!session?.personId) {
      return c.json({ error: "Sign in to confirm your registration." }, 401);
    }
    const body = c.req.valid("json");
    const res = await confirmPaidCheckout({
      orderId: body.orderId,
      personId: session.personId,
    });
    if (!res.ok) {
      const mapped = CHECKOUT_CONFIRM_ERRORS[res.reason];
      return c.json({ error: mapped.error }, mapped.status);
    }
    return c.json({ ok: true });
  });

  return router;
}
