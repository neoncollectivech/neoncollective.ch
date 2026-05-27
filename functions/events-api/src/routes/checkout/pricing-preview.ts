import { eventsService } from "../../services/events.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { runTransaction } from "../../services/transaction";
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

function uniqueAddonIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const trimmed = raw?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function previewCheckoutPricing(
  input: CheckoutPricingPreviewInput,
): Promise<
  CheckoutPricingPreviewSuccess | { ok: false; reason: CheckoutPricingPreviewFailureReason }
> {
  const exclusiveTierId = input.exclusiveTierId?.trim() ?? "";
  const addonTierIds = uniqueAddonIds(input.addonTierIds ?? []);

  return runTransaction(async (tx) => {
    const ev = await eventsService.getPublishedBySlugInTx(tx, input.slug);
    if (!ev) {
      return { ok: false, reason: "event_not_found" };
    }

    const activeTiers = await eventTiersService.listActiveForEvent(ev.id, tx);
    const hasExclusiveTiers = activeTiers.some((t) => t.selectionMode === "exclusive");
    if (hasExclusiveTiers && !exclusiveTierId) {
      return { ok: false, reason: "tier_required" };
    }
    if (!hasExclusiveTiers && addonTierIds.length === 0) {
      return { ok: false, reason: "tiers_required" };
    }

    const selectedIds = [...(exclusiveTierId ? [exclusiveTierId] : []), ...addonTierIds];
    const tierById = new Map(activeTiers.map((t) => [t.id, t]));
    const selectedTiers = [];
    for (const id of selectedIds) {
      const tier = tierById.get(id);
      if (!tier) {
        return { ok: false, reason: "unknown_tier" };
      }
      selectedTiers.push(tier);
    }

    if (exclusiveTierId) {
      const exclusive = tierById.get(exclusiveTierId);
      if (!exclusive || exclusive.selectionMode !== "exclusive") {
        return { ok: false, reason: "invalid_exclusive_tier" };
      }
    }
    for (const id of addonTierIds) {
      const addon = tierById.get(id);
      if (!addon || addon.selectionMode !== "addon") {
        return { ok: false, reason: "invalid_addon_tier" };
      }
    }

    const pricingResult = await resolveCheckoutPricingInTx(tx, {
      eventId: ev.id,
      selectedTiers,
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
