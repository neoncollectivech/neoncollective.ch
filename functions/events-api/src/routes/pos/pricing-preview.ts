import { runTransaction } from "../../services/transaction";
import { eventsService } from "../../services/events.service";
import {
  resolveSelectedCheckoutTiersInTx,
  uniqueCheckoutAddonIds,
} from "../checkout/resolve-selected-tiers";
import { resolveCheckoutPricingInTx } from "../checkout/promotion-pricing";

export async function previewPosPricing(params: {
  eventId: string;
  exclusiveTierId: string;
  addonTierIds: string[];
}): Promise<
  | {
      ok: true;
      amountCents: number;
      subtotalCents: number;
      discountCents: number;
      currency: string;
    }
  | { ok: false; reason: string }
> {
  const exclusiveTierId = params.exclusiveTierId?.trim() ?? "";
  const addonTierIds = uniqueCheckoutAddonIds(params.addonTierIds ?? []);

  return runTransaction(async (tx) => {
    const ev = await eventsService.getInTx(tx, params.eventId);
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

    const pricingResult = await resolveCheckoutPricingInTx(tx, {
      eventId: ev.id,
      selectedTiers: tierResult.selectedTiers,
      promotionCodeRaw: null,
    });
    if (!pricingResult.ok) {
      return { ok: false, reason: pricingResult.reason };
    }

    const currency = tierResult.selectedTiers[0]?.currency ?? "CHF";
    return {
      ok: true,
      amountCents: pricingResult.pricing.amountCents,
      subtotalCents: pricingResult.pricing.subtotalCents,
      discountCents: pricingResult.pricing.discountCents,
      currency,
    };
  });
}
