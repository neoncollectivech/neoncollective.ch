import type Stripe from "stripe";

import { runTransaction, type EntityTx } from "../../services/transaction";
import { normalizeOptionalPhoneE164, phoneToStoredDigits } from "../../helpers/contact";
import { PAYMENT_INTENT_AUTOMATIC_METHODS } from "../../config/stripe";
import {
  paymentIntentAllowsElementsConfirm,
  resolveCheckoutReturnUrl,
  stripe,
} from "../../helpers/stripe";
import {
  computeTierPlacesRemaining,
  eventIdForInviteLinkId,
  findEventInviteeByContact,
} from "../events/read";
import { getTierSoldQty } from "../shared/tier-capacity";
import { findInviteLinkByRawToken } from "../shared/invite-links-orchestration";
import { isSessionProfileComplete } from "../registrations/profile";
import { eventInviteesService } from "../../services/event-invitees.service";
import { IdentityConflictError, peopleService } from "../../services/people.service";
import { fulfillPaidOrderInTx } from "./fulfill-paid-order";
import { eventsService } from "../../services/events.service";
import { ordersService } from "../../services/orders.service";
import { orderTiersService } from "../../services/order-tiers.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { inviteLinksService } from "../../services/invite-links.service";
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
  /** Browser path (+ query) for Stripe `return_url` after redirect-capable PMs (we disable those). */
  returnPath?: string | null;
  session: ResolvedParticipantSession;
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
  | "payment_complete_refresh"
  | "mixed_currency"
  | "checkout_failed";

type CheckoutIntentFailure = {
  ok: false;
  reason: CreateCheckoutIntentFailureReason;
  tierName?: string;
};

type ExistingOrderResolution =
  | { action: "continue" }
  | { action: "resume"; clientSecret: string; orderId: string }
  | {
      action: "blocked";
      reason: "already_registered" | "payment_complete_refresh";
    };

function checkoutFailure(
  reason: CreateCheckoutIntentFailureReason,
  tierName?: string,
): CheckoutIntentFailure {
  return tierName ? { ok: false, reason, tierName } : { ok: false, reason };
}

async function resolveExistingOrderForCheckoutTx(
  tx: CheckoutTx,
  existingOrder: OrderRow,
  selectedTiers: SelectedTier[],
): Promise<ExistingOrderResolution> {
  if (existingOrder.status === "paid") {
    return { action: "blocked", reason: "already_registered" };
  }

  if (existingOrder.status !== "pending") {
    return { action: "continue" };
  }

  if (!existingOrder.stripePaymentIntentId) {
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
    (await pendingOrderTierIdsMatchTx(tx, existingOrder.id, selectedTiers))
  ) {
    if (!paymentIntentAllowsElementsConfirm(pi)) {
      await supersedePendingOrderTx(tx, existingOrder);
      return { action: "continue" };
    }
    return {
      action: "resume",
      clientSecret: pi.client_secret,
      orderId: existingOrder.id,
    };
  }

  await supersedePendingOrderTx(tx, existingOrder);
  return { action: "continue" };
}

function uniqueAddonIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function createCheckoutIntent(input: CheckoutIntentInput): Promise<
  | { ok: true; clientSecret: string; orderId: string; returnUrl: string }
  | CheckoutIntentFailure
> {
  const returnUrl = resolveCheckoutReturnUrl({
    returnPath: input.returnPath,
    locale: input.locale,
    slug: input.slug,
  });
  const exclusiveTierId = input.exclusiveTierId?.trim() ?? "";
  const addonTierIds = uniqueAddonIds(input.addonTierIds ?? []);

  const session = input.session;
  const profileComplete = await isSessionProfileComplete(session);
  if (!profileComplete || !session.personId) {
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
          const linkEventId = await eventIdForInviteLinkId(session.inviteLinkId);
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
        const eventInvitee = await findEventInviteeByContact(
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
          const used = await ordersService.countPendingOrPaidForInviteLink(inviteLinkId, tx);
          if (used + 1 > guestLinkMax) {
            return checkoutFailure("invite_exhausted");
          }
        }
      }

      const activeTiers = await eventTiersService.listActiveForEvent(ev.id, tx);

      const hasExclusiveTiers = activeTiers.some((t) => t.selectionMode === "exclusive");
      if (hasExclusiveTiers && !exclusiveTierId) {
        return checkoutFailure("tier_required");
      }
      if (!hasExclusiveTiers && addonTierIds.length === 0) {
        return checkoutFailure("tiers_required");
      }

      const selectedIds = [
        ...(exclusiveTierId ? [exclusiveTierId] : []),
        ...addonTierIds,
      ];
      const tierById = new Map(activeTiers.map((t) => [t.id, t]));

      const selectedTiers: SelectedTier[] = [];
      for (const id of selectedIds) {
        const tier = tierById.get(id);
        if (!tier) {
          return checkoutFailure("unknown_tier");
        }
        selectedTiers.push(tier);
      }

      if (exclusiveTierId) {
        const exclusive = tierById.get(exclusiveTierId);
        if (!exclusive || exclusive.selectionMode !== "exclusive") {
          return checkoutFailure("invalid_exclusive_tier");
        }
      }
      for (const id of addonTierIds) {
        const addon = tierById.get(id);
        if (!addon || addon.selectionMode !== "addon") {
          return checkoutFailure("invalid_addon_tier");
        }
      }

      const headUsed = await ordersService.countPendingOrPaidForEvent(ev.id, tx);
      const eventRemainingInit =
        ev.eventQuota != null ? Math.max(0, ev.eventQuota - headUsed) : null;
      const eventSlotsLeft =
        eventRemainingInit != null ? eventRemainingInit : Number.POSITIVE_INFINITY;
      const eventRemCur = Number.isFinite(eventSlotsLeft) ? eventSlotsLeft : null;

      if (eventRemCur != null && eventRemCur < 1) {
        return checkoutFailure("event_sold_out");
      }

      for (const tier of selectedTiers) {
        const sold = await getTierSoldQty(ev.id, tier.id, tx);
        const placesCap = computeTierPlacesRemaining({
          tierQuota: tier.quota,
          sold,
          eventRemaining: eventRemCur,
        });
        const capForCompare = placesCap == null ? Number.POSITIVE_INFINITY : placesCap;
        if (1 > capForCompare) {
          return checkoutFailure("tier_sold_out", tier.name);
        }
      }

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

      const existingOrder = await ordersService.findPendingOrPaidForPersonOnEventInTx(
        tx,
        ev.id,
        personId,
      );

      if (existingOrder) {
        const resolved = await resolveExistingOrderForCheckoutTx(
          tx,
          existingOrder,
          selectedTiers,
        );
        if (resolved.action === "blocked") {
          return checkoutFailure(resolved.reason);
        }
        if (resolved.action === "resume") {
          return {
            ok: true,
            clientSecret: resolved.clientSecret,
            orderId: resolved.orderId,
            returnUrl,
          };
        }
      }

      const amountCents = selectedTiers.reduce((sum, t) => sum + t.priceCents, 0);
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
        amountCents,
        inviteLinkId,
      });

      await orderTiersService.insertLinesInTx(
        tx,
        selectedTiers.map((tier) => ({
          orderId,
          eventTierId: tier.id,
          unitPriceCents: tier.priceCents,
        })),
      );

      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        metadata: { orderId, eventId: ev.id },
        automatic_payment_methods: PAYMENT_INTENT_AUTOMATIC_METHODS,
      });
      await ordersService.attachStripePaymentIntentInTx(tx, orderId, pi.id);
      return {
        ok: true,
        clientSecret: pi.client_secret!,
        orderId,
        returnUrl,
      };
    });
  } catch {
    return checkoutFailure("checkout_failed");
  }
}

