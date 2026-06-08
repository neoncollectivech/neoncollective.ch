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
import { getSumUpPaymentStatusByClientTransactionId, createSumUpReaderCheckout, SumUpCheckoutError } from "../../helpers/sumup";
import { fulfillPaidOrderFromSumup, fulfillPaidOrderInTx } from "../checkout/fulfill-paid-order";
import { handleFulfillmentResult } from "../checkout/handle-fulfillment-result";
import { isSumUpConfigured } from "../../config/sumup";
import { resolvePendingPosOrderInTx } from "./resolve-pending-pos-order";

export type CreatePosSaleInput = {
  eventId: string;
  soldBy: string;
  readerId: string;
  locale: "de" | "en" | "it";
  exclusiveTierId: string;
  addonTierIds: string[];
  personId?: string | null;
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
  | "reader_offline"
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

type PreparedPosCharge = {
  orderId: string;
  amountCents: number;
  currency: string;
  eventTitle: string;
  readerId: string;
};

async function completeAlreadyPaidPosOrder(orderId: string): Promise<CreatePosSaleSuccess | null> {
  const result = await fulfillPaidOrderFromSumup({
    orderId,
    source: "sumup_poll",
  });
  if (result.kind === "failed") {
    return null;
  }
  await handleFulfillmentResult(result);
  const order = await ordersService.get(orderId);
  if (!order || order.status !== "paid") {
    return null;
  }
  return {
    ok: true,
    orderId,
    amountCents: order.amountCents,
    readerId: order.sumupReaderId ?? "",
    paymentStatus: "paid",
    requiresPayment: false,
  };
}

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
    personId: input.personId,
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
    if (guestResult.reason === "person_not_found") {
      return { ok: false, reason: "contact_required" };
    }
    return { ok: false, reason: "contact_required" };
  }

  const personId = guestResult.guest.personId;

  try {
    const prepared = await runTransaction(async (tx) => {
      const ev = await eventsService.getInTx(tx, input.eventId);
      if (!ev || ev.status !== "published") {
        return { ok: false as const, reason: "event_not_found" as const };
      }

      const tierResult = await resolveSelectedCheckoutTiersInTx(tx, {
        eventId: ev.id,
        exclusiveTierId,
        addonTierIds,
      });
      if (!tierResult.ok) {
        return { ok: false as const, reason: tierResult.reason };
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
          ? {
              ok: false as const,
              reason: eligibility.reason,
              tierName: eligibility.tierName,
            }
          : { ok: false as const, reason: eligibility.reason };
      }

      const pricingResult = await resolveCheckoutPricingInTx(tx, {
        eventId: ev.id,
        selectedTiers,
        promotionCodeRaw: null,
      });
      if (!pricingResult.ok) {
        return { ok: false as const, reason: "checkout_failed" as const };
      }
      const pricing = pricingResult.pricing;

      const currency = selectedTiers[0]!.currency.toLowerCase();
      const mixedCurrency = selectedTiers.some(
        (t) => t.currency.toLowerCase() !== currency,
      );
      if (mixedCurrency) {
        return { ok: false as const, reason: "mixed_currency" as const };
      }

      const checkoutPerson = await peopleService.getInTx(tx, personId);
      if (checkoutPerson) {
        await eventInviteesService.syncEventInviteesToPersonInTx(tx, personId, {
          email: checkoutPerson.email?.trim().toLowerCase() ?? null,
          phone: checkoutPerson.phone ?? null,
        });
      }

      const pendingResolution = await resolvePendingPosOrderInTx(tx, {
        eventId: ev.id,
        personId,
        readerId: input.readerId,
        selectedTiers,
        pricing,
        exclusiveTierIds,
        eventTitle: ev.title,
      });

      if (pendingResolution.action === "resume") {
        return {
          ok: true as const,
          kind: "charge" as const,
          orderId: pendingResolution.order.id,
          amountCents: pendingResolution.order.amountCents,
          currency: pendingResolution.currency,
          eventTitle: pendingResolution.eventTitle,
          readerId: input.readerId,
        };
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
          return { ok: false as const, reason: "checkout_failed" as const };
        }
        return {
          ok: true as const,
          kind: "free" as const,
          orderId,
          readerId: input.readerId,
        };
      }

      return {
        ok: true as const,
        kind: "charge" as const,
        orderId,
        amountCents: pricing.amountCents,
        currency,
        eventTitle: ev.title,
        readerId: input.readerId,
      };
    });

    if (!prepared.ok) {
      return prepared.tierName
        ? { ok: false, reason: prepared.reason, tierName: prepared.tierName }
        : { ok: false, reason: prepared.reason };
    }

    if (prepared.kind === "free") {
      return {
        ok: true,
        orderId: prepared.orderId,
        amountCents: 0,
        readerId: prepared.readerId,
        paymentStatus: "paid",
        requiresPayment: false,
      };
    }

    const charge: PreparedPosCharge = {
      orderId: prepared.orderId,
      amountCents: prepared.amountCents,
      currency: prepared.currency,
      eventTitle: prepared.eventTitle,
      readerId: prepared.readerId,
    };

    const orderBeforeCheckout = await ordersService.get(charge.orderId);
    if (orderBeforeCheckout?.sumupClientTransactionId) {
      const paymentStatus = await getSumUpPaymentStatusByClientTransactionId(
        orderBeforeCheckout.sumupClientTransactionId,
      );
      if (paymentStatus === "successful") {
        const completed = await completeAlreadyPaidPosOrder(charge.orderId);
        if (completed) {
          return completed;
        }
      }
    }

    const orderForCheckout = await ordersService.get(charge.orderId);
    if (!orderForCheckout) {
      return { ok: false, reason: "checkout_failed" };
    }

    if (orderForCheckout.sumupClientTransactionId?.trim()) {
      return {
        ok: true,
        orderId: charge.orderId,
        amountCents: charge.amountCents,
        readerId: charge.readerId,
        paymentStatus: "pending",
        requiresPayment: true,
      };
    }

    let clientTransactionId: string;
    try {
      clientTransactionId = await createSumUpReaderCheckout({
        readerId: charge.readerId,
        orderId: charge.orderId,
        amountCents: charge.amountCents,
        currency: charge.currency,
        description: `${charge.eventTitle} — door POS`,
      });
    } catch (error) {
      await runTransaction((tx) => ordersService.failOrderInTx(tx, charge.orderId));
      if (error instanceof SumUpCheckoutError && error.code === "reader_offline") {
        return { ok: false, reason: "reader_offline" };
      }
      return { ok: false, reason: "reader_checkout_failed" };
    }

    await runTransaction((tx) =>
      ordersService.attachSumupCheckoutInTx(tx, charge.orderId, clientTransactionId),
    );

    return {
      ok: true,
      orderId: charge.orderId,
      amountCents: charge.amountCents,
      readerId: charge.readerId,
      paymentStatus: "pending",
      requiresPayment: true,
    };
  } catch {
    return { ok: false, reason: "checkout_failed" };
  }
}
