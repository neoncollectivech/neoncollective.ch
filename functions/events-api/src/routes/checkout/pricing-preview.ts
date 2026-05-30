import { eventsService } from "../../services/events.service";
import { runTransaction } from "../../services/transaction";
import {
  resolveSelectedCheckoutTiersInTx,
  uniqueCheckoutAddonIds,
} from "./resolve-selected-tiers";
import { resolveCheckoutPricingInTx } from "./promotion-pricing";

export type CheckoutPricingPreviewInput = {
  slug: string;
  exclusiveTierId: string;
  addonTierIds: string[];
  promotionCode: string | null;
};

export type CheckoutPricingPreviewSuccess = {
  ok: true;
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
};

export type CheckoutPricingPreviewFailureReason =
  | "event_not_found"
  | "tier_required"
  | "tiers_required"
  | "unknown_tier"
  | "invalid_exclusive_tier"
  | "invalid_addon_tier"
  | "invalid_promotion"
  | "promotion_exhausted";

export async function previewCheckoutPricing(
  input: CheckoutPricingPreviewInput,
): Promise<
  CheckoutPricingPreviewSuccess | { ok: false; reason: CheckoutPricingPreviewFailureReason }
> {
  const exclusiveTierId = input.exclusiveTierId?.trim() ?? "";
  const addonTierIds = uniqueCheckoutAddonIds(input.addonTierIds ?? []);

  return runTransaction(async (tx) => {
    const ev = await eventsService.getPublishedBySlugInTx(tx, input.slug);
    if (!ev) {
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
      promotionCodeRaw: input.promotionCode,
    });
    if (!pricingResult.ok) {
      return { ok: false, reason: pricingResult.reason };
    }

    return {
      ok: true,
      amountCents: pricingResult.pricing.amountCents,
      subtotalCents: pricingResult.pricing.subtotalCents,
      discountCents: pricingResult.pricing.discountCents,
    };
  });
}
