import { runTransaction } from "../../services/transaction";
import { eventsService } from "../../services/events.service";
import { ordersService } from "../../services/orders.service";
import { orderTiersService } from "../../services/order-tiers.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { eventInviteesService } from "../../services/event-invitees.service";
import { peopleService } from "../../services/people.service";
import {
  resolveSelectedCheckoutTiersInTx,
  uniqueCheckoutAddonIds,
} from "../checkout/resolve-selected-tiers";
import { resolveCheckoutPricingInTx } from "../checkout/promotion-pricing";
import { assertPosSaleEligibilityInTx } from "../checkout/shared-pos-eligibility";
import { resolvePosGuest } from "./resolve-pos-guest";
import { createSumUpReaderCheckout } from "../../helpers/sumup";
import { fulfillPaidOrderInTx } from "../checkout/fulfill-paid-order";
import { isSumUpConfigured } from "../../config/sumup";

export type CreatePosSaleInput = {
  eventId: string;
  soldBy: string;
  readerId: string;
  locale: "de" | "en" | "it";
  exclusiveTierId: string;
  addonTierIds: string[];
  credential?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  givenName?: string | null;
  familyName?: string | null;
};

export type CreatePosSaleFailureReason =
  | "event_not_found"
  | "sumup_not_configured"
  | "contact_required"
  | "identity_conflict"
  | "admission_not_found"
  | "tier_required"
  | "tiers_required"
  | "unknown_tier"
  | "invalid_exclusive_tier"
  | "invalid_addon_tier"
  | "already_registered"
  | "addon_only_requires_exclusive"
  | "addon_already_purchased"
  | "event_sold_out"
  | "tier_sold_out"
  | "mixed_currency"
  | "reader_checkout_failed"
  | "checkout_failed";

export type CreatePosSaleSuccess = {
  ok: true;
  orderId: string;
  amountCents: number;
  readerId: string;
  paymentStatus: "pending" | "paid";
  requiresPayment: boolean;
};

export type CreatePosSaleResult = CreatePosSaleSuccess | {
  ok: false;
  reason: CreatePosSaleFailureReason;
  tierName?: string;
};

export async function createPosSale(input: CreatePosSaleInput): Promise<CreatePosSaleResult> {
  if (!isSumUpConfigured()) {
    return { ok: false, reason: "sumup_not_configured" };
  }

  const exclusiveTierId = input.exclusiveTierId?.trim() ?? "";
  const addonTierIds = uniqueCheckoutAddonIds(input.addonTierIds ?? []);

  const evRow = await eventsService.get(input.eventId);
  if (!evRow || evRow.status !== "published") {
    return { ok: false, reason: "event_not_found" };
  }

  const guestResult = await resolvePosGuest({
    eventId: input.eventId,
    eventQuota: evRow.eventQuota,
    credential: input.credential,
    email: input.email,
    phoneE164: input.phoneE164,
    givenName: input.givenName,
    familyName: input.familyName,
  });

  if (!guestResult.ok) {
    if (guestResult.reason === "identity_conflict") {
      return { ok: false, reason: "identity_conflict" };
    }
    if (guestResult.reason === "admission_not_found") {
      return { ok: false, reason: "admission_not_found" };
    }
    return { ok: false, reason: "contact_required" };
  }

  const personId = guestResult.guest.personId;

  try {
    return await runTransaction(async (tx) => {
      const ev = await eventsService.getInTx(tx, input.eventId);
      if (!ev || ev.status !== "published") {
        return { ok: false, reason: "event_not_found" };
      }

      const tierResult = await resolveSelectedCheckoutTiersInTx(tx, {
        eventId: ev.id,
        exclusiveTierId,
        addonTierIds,
      });
      if (!tierResult.ok) {
        return { ok: false, reason: tierResult.reason };
      }
      const selectedTiers = tierResult.selectedTiers;

      const activeTiers = await eventTiersService.listActiveForEvent(ev.id, tx);
      const exclusiveTierIds = activeTiers
        .filter((tier) => tier.selectionMode === "exclusive")
        .map((tier) => tier.id);

      const eligibility = await assertPosSaleEligibilityInTx(tx, {
        eventId: ev.id,
        personId,
        selectedTiers,
        eventQuota: ev.eventQuota,
        exclusiveTierIds,
        addonTierIds,
      });
      if (!eligibility.ok) {
        return eligibility.tierName
          ? { ok: false, reason: eligibility.reason, tierName: eligibility.tierName }
          : { ok: false, reason: eligibility.reason };
      }

      const pricingResult = await resolveCheckoutPricingInTx(tx, {
        eventId: ev.id,
        selectedTiers,
        promotionCodeRaw: null,
      });
      if (!pricingResult.ok) {
        return { ok: false, reason: "checkout_failed" };
      }
      const pricing = pricingResult.pricing;

      const currency = selectedTiers[0]!.currency.toLowerCase();
      const mixedCurrency = selectedTiers.some(
        (t) => t.currency.toLowerCase() !== currency,
      );
      if (mixedCurrency) {
        return { ok: false, reason: "mixed_currency" };
      }

      const checkoutPerson = await peopleService.getInTx(tx, personId);
      if (checkoutPerson) {
        await eventInviteesService.syncEventInviteesToPersonInTx(tx, personId, {
          email: checkoutPerson.email?.trim().toLowerCase() ?? null,
          phone: checkoutPerson.phone ?? null,
        });
      }

      const orderId = await ordersService.createPendingOrderInTx(tx, {
        eventId: ev.id,
        personId,
        locale: input.locale,
        amountCents: pricing.amountCents,
        inviteLinkId: null,
        promotionCodeId: pricing.promotionCodeId,
        paymentProvider: "sumup",
        posSoldBy: input.soldBy,
        sumupReaderId: input.readerId,
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
        const fulfill = await fulfillPaidOrderInTx(tx, {
          orderId,
          source: "client",
        });
        if (fulfill.kind === "failed") {
          return { ok: false, reason: "checkout_failed" };
        }
        return {
          ok: true,
          orderId,
          amountCents: 0,
          readerId: input.readerId,
          paymentStatus: "paid",
          requiresPayment: false,
        };
      }

      let clientTransactionId: string;
      try {
        clientTransactionId = await createSumUpReaderCheckout({
          readerId: input.readerId,
          orderId,
          amountCents: pricing.amountCents,
          currency,
          description: `${ev.title} — door POS`,
        });
      } catch {
        await ordersService.failOrderInTx(tx, orderId);
        return { ok: false, reason: "reader_checkout_failed" };
      }

      await ordersService.attachSumupCheckoutInTx(tx, orderId, clientTransactionId);

      return {
        ok: true,
        orderId,
        amountCents: pricing.amountCents,
        readerId: input.readerId,
        paymentStatus: "pending",
        requiresPayment: true,
      };
    });
  } catch {
    return { ok: false, reason: "checkout_failed" };
  }
}
