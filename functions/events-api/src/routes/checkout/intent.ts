import type Stripe from "stripe";

import { runTransaction, type EntityTx } from "../../services/transaction";
import { normalizeOptionalPhoneE164, phoneToStoredDigits } from "../../helpers/contact";
import { PAYMENT_INTENT_METHOD_TYPES } from "../../config/stripe";
import {
  resolveCheckoutReturnUrl,
  stripe,
} from "../../helpers/stripe";
import {
  computeTierPlacesRemaining,
  getExclusiveTierLinesSoldQty,
  getTierSoldQty,
} from "../../helpers/tier-capacity";
import { inviteLinksService } from "../../services/invite-links.service";
import { findInviteLinkByRawToken } from "../shared/invite-links-orchestration";
import { isSessionReadyForCheckout } from "../registrations/profile";
import { eventInviteesService } from "../../services/event-invitees.service";
import { IdentityConflictError, peopleService } from "../../services/people.service";
import { fulfillPaidOrderInTx } from "./fulfill-paid-order";
import { eventRegistrationsService } from "../../services/event-registrations.service";
import { eventsService } from "../../services/events.service";
import { ordersService } from "../../services/orders.service";
import { orderTiersService } from "../../services/order-tiers.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { splitOrdersByModeTx } from "./shared-pos-eligibility";
import {
  resolveSelectedCheckoutTiersInTx,
  uniqueCheckoutAddonIds,
} from "./resolve-selected-tiers";
import { resolveCheckoutPricingInTx } from "./promotion-pricing";
import type { ResolvedCheckoutPricing } from "./promotion-pricing";
import type { ResolvedParticipantSession } from "../registrations/session";

type CheckoutTx = EntityTx;
type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.get>>>;
type SelectedTier = NonNullable<Awaited<ReturnType<typeof eventTiersService.listActiveForEvent>>>[number];

const RESUMABLE_PI_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

export type CheckoutIntentInput = {
  slug: string;
  email: string | null;
  locale: "de" | "en" | "it";
  phoneE164: string | null;
  inviteToken: string | null;
  exclusiveTierId: string;
  addonTierIds: string[];
  /** Browser path (+ query) for Stripe `return_url` after redirect PMs (e.g. TWINT). */
  returnPath?: string | null;
  promotionCode?: string | null;
  session: ResolvedParticipantSession;
};

export type CheckoutIntentSuccess = {
  ok: true;
  orderId: string;
  returnUrl: string;
  requiresPayment: boolean;
  clientSecret?: string;
  amountCents: number;
};

function normalizedCheckoutEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase();
}

async function pendingOrderTierIdsMatchTx(
  tx: CheckoutTx,
  orderId: string,
  selectedTiers: SelectedTier[],
): Promise<boolean> {
  return orderTiersService.pendingOrderTierIdsMatch(
    orderId,
    selectedTiers.map((t) => t.id),
    tx,
  );
}

async function supersedePendingOrderTx(
  tx: CheckoutTx,
  order: OrderRow,
): Promise<void> {
  if (order.stripePaymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
    } catch {
      /* already canceled or captured */
    }
  }
  await ordersService.failOrderInTx(tx, order.id);
}

export type CreateCheckoutIntentFailureReason =
  | "not_authenticated"
  | "profile_incomplete"
  | "profile_not_found"
  | "invalid_phone"
  | "event_not_found"
  | "invalid_invite"
  | "contact_required"
  | "invitee_ambiguous"
  | "invite_only_denied"
  | "invite_exhausted"
  | "tier_required"
  | "tiers_required"
  | "unknown_tier"
  | "invalid_exclusive_tier"
  | "invalid_addon_tier"
  | "event_sold_out"
  | "tier_sold_out"
  | "identity_conflict"
  | "profile_mismatch"
  | "already_registered"
  | "upsell_addon_only"
  | "addon_already_purchased"
  | "payment_complete_refresh"
  | "mixed_currency"
  | "invalid_promotion"
  | "promotion_exhausted"
  | "checkout_failed";

type CheckoutIntentFailure = {
  ok: false;
  reason: CreateCheckoutIntentFailureReason;
  tierName?: string;
};

type ExistingOrderResolution =
  | { action: "continue" }
  | {
      action: "resume";
      orderId: string;
      requiresPayment: boolean;
      clientSecret?: string;
      amountCents: number;
    }
  | {
      action: "blocked";
      reason: "already_registered" | "payment_complete_refresh";
    };

function isExclusiveSelection(selectedTiers: SelectedTier[]): boolean {
  return selectedTiers.some((tier) => tier.selectionMode === "exclusive");
}

type OrdersByMode = {
  exclusiveOrders: OrderRow[];
  addonOnlyOrders: OrderRow[];
};

async function findAlreadyPurchasedAddonIdsTx(
  tx: CheckoutTx,
  params: {
    eventId: string;
    personId: string;
    addonTierIds: string[];
    ignoreOrderId?: string;
  },
): Promise<string[]> {
  if (params.addonTierIds.length === 0) {
    return [];
  }
  const orderIds = await ordersService.listIdsForPersonOnEventAndStatusesInTx(tx, {
    eventId: params.eventId,
    personId: params.personId,
    statuses: ["pending", "paid"],
  });
  const filteredOrderIds = params.ignoreOrderId
    ? orderIds.filter((id) => id !== params.ignoreOrderId)
    : orderIds;
  const tierIds = await orderTiersService.listTierIdsAmongOrderIds(filteredOrderIds, tx);
  const owned = new Set(tierIds);
  return params.addonTierIds.filter((id) => owned.has(id));
}

async function pendingOrderMatchesCheckoutTx(
  tx: CheckoutTx,
  order: OrderRow,
  selectedTiers: SelectedTier[],
  pricing: ResolvedCheckoutPricing,
): Promise<boolean> {
  if (order.amountCents !== pricing.amountCents) {
    return false;
  }
  if ((order.promotionCodeId ?? null) !== pricing.promotionCodeId) {
    return false;
  }
  if (!(await pendingOrderTierIdsMatchTx(tx, order.id, selectedTiers))) {
    return false;
  }
  const lines = await orderTiersService.listForOrder(order.id, tx);
  if (lines.length !== pricing.lines.length) {
    return false;
  }
  const priceByTier = new Map(
    pricing.lines.map((line) => [line.eventTierId, line.unitPriceCents]),
  );
  for (const line of lines) {
    if (priceByTier.get(line.eventTierId) !== line.unitPriceCents) {
      return false;
    }
  }
  return true;
}

function intentSuccess(
  params: Omit<CheckoutIntentSuccess, "ok">,
): CheckoutIntentSuccess {
  return { ok: true, ...params };
}

function checkoutFailure(
  reason: CreateCheckoutIntentFailureReason,
  tierName?: string,
): CheckoutIntentFailure {
  return tierName ? { ok: false, reason, tierName } : { ok: false, reason };
}

/** Pending order on this event/person is superseded or resumed — do not count it toward quota. */
function checkoutCapacityExcludeOrderId(
  existingOrder: OrderRow | null,
): string | undefined {
  return existingOrder?.status === "pending" ? existingOrder.id : undefined;
}

async function decrementCountIfExcludedPendingOrderTx(
  tx: CheckoutTx,
  count: number,
  excludeOrderId: string | undefined,
  matches: (order: OrderRow) => boolean,
): Promise<number> {
  if (!excludeOrderId) {
    return count;
  }
  const excluded = await ordersService.getInTx(tx, excludeOrderId);
  if (!excluded || excluded.status !== "pending" || !matches(excluded)) {
    return count;
  }
  return Math.max(0, count - 1);
}

async function resolveExistingOrderForCheckoutTx(
  tx: CheckoutTx,
  existingOrder: OrderRow,
  selectedTiers: SelectedTier[],
  pricing: ResolvedCheckoutPricing,
): Promise<ExistingOrderResolution> {
  if (existingOrder.status === "paid") {
    return { action: "blocked", reason: "already_registered" };
  }

  if (existingOrder.status !== "pending") {
    return { action: "continue" };
  }

  if (!existingOrder.stripePaymentIntentId) {
    if (
      existingOrder.amountCents === 0 &&
      (await pendingOrderMatchesCheckoutTx(tx, existingOrder, selectedTiers, pricing))
    ) {
      return {
        action: "resume",
        orderId: existingOrder.id,
        requiresPayment: false,
        amountCents: 0,
      };
    }
    await supersedePendingOrderTx(tx, existingOrder);
    return { action: "continue" };
  }

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(existingOrder.stripePaymentIntentId);
  } catch {
    await supersedePendingOrderTx(tx, existingOrder);
    return { action: "continue" };
  }

  if (pi.status === "succeeded") {
    await fulfillPaidOrderInTx(tx, {
      orderId: existingOrder.id,
      source: "client",
      paymentIntentStatus: pi.status,
    });
    return { action: "blocked", reason: "payment_complete_refresh" };
  }

  if (pi.status === "canceled") {
    await supersedePendingOrderTx(tx, existingOrder);
    return { action: "continue" };
  }

  if (
    RESUMABLE_PI_STATUSES.has(pi.status) &&
    pi.client_secret &&
    pi.amount === pricing.amountCents &&
    (await pendingOrderMatchesCheckoutTx(tx, existingOrder, selectedTiers, pricing))
  ) {
    return {
      action: "resume",
      clientSecret: pi.client_secret,
      orderId: existingOrder.id,
      requiresPayment: true,
      amountCents: pricing.amountCents,
    };
  }

  await supersedePendingOrderTx(tx, existingOrder);
  return { action: "continue" };
}

export async function createCheckoutIntent(
  input: CheckoutIntentInput,
): Promise<CheckoutIntentSuccess | CheckoutIntentFailure> {
  const returnUrl = resolveCheckoutReturnUrl({
    returnPath: input.returnPath,
    locale: input.locale,
    slug: input.slug,
  });
  const exclusiveTierId = input.exclusiveTierId?.trim() ?? "";
  const addonTierIds = uniqueCheckoutAddonIds(input.addonTierIds ?? []);

  const session = input.session;
  const profileReady = await isSessionReadyForCheckout(session);
  if (!profileReady || !session.personId) {
    return checkoutFailure("profile_incomplete");
  }

  const profilePerson = await peopleService.get(session.personId);
  if (!profilePerson) {
    return checkoutFailure("profile_not_found");
  }

  try {
    return await runTransaction(async (tx) => {
      let normalizedPhone: string | null = null;
      if (input.phoneE164?.trim()) {
        normalizedPhone = normalizeOptionalPhoneE164(input.phoneE164);
        if (!normalizedPhone) {
          return checkoutFailure("invalid_phone");
        }
      }

      const ev = await eventsService.getPublishedBySlugInTx(tx, input.slug);
      if (!ev) {
        return checkoutFailure("event_not_found");
      }

      let inviteLinkMaxRedemptions: number | null = null;

      let inviteLinkId: string | null = null;
      if (ev.accessMode === "invite_only") {
        let guestLinkId: string | null = null;
        let guestLinkMax: number | null = null;
        if (input.inviteToken) {
          const guest = await findInviteLinkByRawToken(input.inviteToken, {
            tx,
            includeInviter: false,
          });
          if (!guest || guest.event.id !== ev.id) {
            return checkoutFailure("invalid_invite");
          }
          guestLinkId = guest.link.id;
          guestLinkMax = guest.link.maxRedemptions;
        }
        if (!guestLinkId && session.inviteLinkId) {
          const linkEventId = await inviteLinksService.eventIdForLinkId(session.inviteLinkId);
          if (linkEventId === ev.id) {
            guestLinkId = session.inviteLinkId;
            guestLinkMax = await inviteLinksService.getMaxRedemptions(session.inviteLinkId, tx);
          }
        }
        const checkoutEmailForEventInvite =
          profilePerson.email?.trim()?.toLowerCase() ??
          normalizedCheckoutEmail(input.email);
        const phoneDigits = phoneToStoredDigits(
          profilePerson.phone
            ? `+${profilePerson.phone.replace(/\D/g, "")}`
            : normalizedPhone,
        );
        if (!checkoutEmailForEventInvite && !phoneDigits) {
          return checkoutFailure("contact_required");
        }
        const eventInvitee = await eventInviteesService.findInviteeByContactWithPersonFallback(
          ev.id,
          checkoutEmailForEventInvite ?? "",
          phoneDigits,
        );
        if (eventInvitee === "ambiguous") {
          return checkoutFailure("invitee_ambiguous");
        }
        const isHost = eventInvitee !== null;
        const isGuest = guestLinkId !== null;
        if (!isHost && !isGuest) {
          return checkoutFailure("invite_only_denied");
        }
        if (isGuest && guestLinkId && guestLinkMax != null) {
          inviteLinkId = guestLinkId;
          inviteLinkMaxRedemptions = guestLinkMax;
        }
      }

      const tierResult = await resolveSelectedCheckoutTiersInTx(tx, {
        eventId: ev.id,
        exclusiveTierId,
        addonTierIds,
      });
      if (!tierResult.ok) {
        return checkoutFailure(tierResult.reason);
      }
      const selectedTiers = tierResult.selectedTiers;

      const checkoutEmail =
        profilePerson.email?.trim()?.toLowerCase() ??
        normalizedCheckoutEmail(input.email);
      const profilePhoneE164 = profilePerson.phone
        ? `+${profilePerson.phone.replace(/\D/g, "")}`
        : null;
      const checkoutPhone = profilePhoneE164 ?? normalizedPhone;
      if (!checkoutEmail && !checkoutPhone) {
        return checkoutFailure("contact_required");
      }

      let personId: string;
      try {
        personId = await peopleService.ensurePersonInTx(tx, {
          givenName: profilePerson.givenName,
          familyName: profilePerson.familyName,
          email: checkoutEmail,
          phoneE164: checkoutPhone,
        });
      } catch (e) {
        if (e instanceof IdentityConflictError) {
          return checkoutFailure("identity_conflict");
        }
        throw e;
      }

      if (personId !== session.personId) {
        return checkoutFailure("profile_mismatch");
      }

      const checkoutPerson = await peopleService.getInTx(tx, personId);
      if (checkoutPerson) {
        await eventInviteesService.syncEventInviteesToPersonInTx(tx, personId, {
          email: checkoutPerson.email?.trim().toLowerCase() ?? null,
          phone: checkoutPerson.phone ?? null,
        });
      }

      const activeTiers = await eventTiersService.listActiveForEvent(ev.id, tx);
      const exclusiveTierIds = activeTiers
        .filter((tier) => tier.selectionMode === "exclusive")
        .map((tier) => tier.id);
      const selectedHasExclusive = isExclusiveSelection(selectedTiers);

      const personOrders = await ordersService.listPendingOrPaidForPersonOnEventInTx(
        tx,
        ev.id,
        personId,
      );
      const splitOrders: OrdersByMode = await splitOrdersByModeTx(
        tx,
        personOrders,
        exclusiveTierIds,
      );
      const hasPaidExclusiveSeat = await eventRegistrationsService.hasConfirmedRegistrationInTx(
        tx,
        personId,
        ev.id,
      );
      const latestPendingExclusiveOrder =
        splitOrders.exclusiveOrders.find((order) => order.status === "pending") ??
        null;
      const latestPendingAddonOnlyOrder =
        splitOrders.addonOnlyOrders.find((order) => order.status === "pending") ??
        null;

      if (selectedHasExclusive && hasPaidExclusiveSeat) {
        return checkoutFailure("already_registered");
      }

      if (!selectedHasExclusive && !hasPaidExclusiveSeat) {
        return checkoutFailure("upsell_addon_only");
      }

      const existingOrder = selectedHasExclusive
        ? latestPendingExclusiveOrder
        : latestPendingAddonOnlyOrder;
      const capacityExcludeOrderId = checkoutCapacityExcludeOrderId(existingOrder);

      if (selectedHasExclusive && inviteLinkId && inviteLinkMaxRedemptions != null) {
        let used = await ordersService.countPendingOrPaidForInviteLink(inviteLinkId, tx);
        used = await decrementCountIfExcludedPendingOrderTx(
          tx,
          used,
          capacityExcludeOrderId,
          (order) => order.inviteLinkId === inviteLinkId,
        );
        if (used + 1 > inviteLinkMaxRedemptions) {
          return checkoutFailure("invite_exhausted");
        }
      }

      const pricingResult = await resolveCheckoutPricingInTx(tx, {
        eventId: ev.id,
        selectedTiers,
        promotionCodeRaw: input.promotionCode,
        excludeOrderId: capacityExcludeOrderId,
      });
      if (!pricingResult.ok) {
        return checkoutFailure(pricingResult.reason);
      }
      const pricing = pricingResult.pricing;

      if (existingOrder) {
        const resolved = await resolveExistingOrderForCheckoutTx(
          tx,
          existingOrder,
          selectedTiers,
          pricing,
        );
        if (resolved.action === "blocked") {
          return checkoutFailure(resolved.reason);
        }
        if (resolved.action === "resume") {
          return intentSuccess({
            orderId: resolved.orderId,
            returnUrl,
            requiresPayment: resolved.requiresPayment,
            clientSecret: resolved.clientSecret,
            amountCents: resolved.amountCents,
          });
        }
      }

      if (!selectedHasExclusive) {
        const alreadyPurchased = await findAlreadyPurchasedAddonIdsTx(tx, {
          eventId: ev.id,
          personId,
          addonTierIds,
          ignoreOrderId: existingOrder?.id,
        });
        if (alreadyPurchased.length > 0) {
          return checkoutFailure("addon_already_purchased");
        }
        inviteLinkId = null;
      }

      const eventRemainingForSelection = selectedHasExclusive
        ? ev.eventQuota != null
          ? Math.max(
              0,
              ev.eventQuota -
                (await getExclusiveTierLinesSoldQty(
                  ev.id,
                  exclusiveTierIds,
                  tx,
                  capacityExcludeOrderId,
                )),
            )
          : null
        : null;

      if (selectedHasExclusive && eventRemainingForSelection != null && eventRemainingForSelection < 1) {
        return checkoutFailure("event_sold_out");
      }

      for (const tier of selectedTiers) {
        const sold = await getTierSoldQty(ev.id, tier.id, tx, capacityExcludeOrderId);
        const placesCap = computeTierPlacesRemaining({
          tierQuota: tier.quota,
          sold,
          eventRemaining:
            selectedHasExclusive && tier.selectionMode === "exclusive"
              ? eventRemainingForSelection
              : null,
        });
        const capForCompare = placesCap == null ? Number.POSITIVE_INFINITY : placesCap;
        if (1 > capForCompare) {
          return checkoutFailure("tier_sold_out", tier.name);
        }
      }

      const currency = selectedTiers[0]!.currency.toLowerCase();
      const mixedCurrency = selectedTiers.some(
        (t) => t.currency.toLowerCase() !== currency,
      );
      if (mixedCurrency) {
        return checkoutFailure("mixed_currency");
      }

      const orderId = await ordersService.createPendingOrderInTx(tx, {
        eventId: ev.id,
        personId,
        locale: input.locale,
        amountCents: pricing.amountCents,
        inviteLinkId,
        promotionCodeId: pricing.promotionCodeId,
      });

      await orderTiersService.insertLinesInTx(
        tx,
        pricing.lines.map((line) => ({
          orderId,
          eventTierId: line.eventTierId,
          unitPriceCents: line.unitPriceCents,
        })),
      );

      if (pricing.amountCents === 0) {
        return intentSuccess({
          orderId,
          returnUrl,
          requiresPayment: false,
          amountCents: 0,
        });
      }

      const pi = await stripe.paymentIntents.create({
        amount: pricing.amountCents,
        currency,
        metadata: { orderId, eventId: ev.id },
        payment_method_types: PAYMENT_INTENT_METHOD_TYPES,
      });
      await ordersService.attachStripePaymentIntentInTx(tx, orderId, pi.id);
      return intentSuccess({
        orderId,
        returnUrl,
        requiresPayment: true,
        clientSecret: pi.client_secret!,
        amountCents: pricing.amountCents,
      });
    });
  } catch {
    return checkoutFailure("checkout_failed");
  }
}

