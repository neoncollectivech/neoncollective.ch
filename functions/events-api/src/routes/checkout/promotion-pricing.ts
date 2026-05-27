import {
  applyPromotionToLines,
  normalizePromotionCode,
  type CheckoutPricingLine,
  type PromotionForPricing,
} from "../../helpers/promotion-code";
import type { promotionCodes } from "../../db/schema";
import { ordersService } from "../../services/orders.service";
import { promotionCodesService } from "../../services/promotion-codes.service";
import type { EntityTx } from "../../services/transaction";

export type ResolvePromotionFailureReason =
  | "invalid_promotion"
  | "promotion_exhausted";

export type ResolvedCheckoutPricing = {
  lines: CheckoutPricingLine[];
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
  promotionCodeId: string | null;
};

type SelectedTier = {
  id: string;
  priceCents: number;
  currency: string;
};

function promotionRowToPricing(row: typeof promotionCodes.$inferSelect): PromotionForPricing {
  return {
    kind: row.kind,
    percentBps: row.percentBps,
    amountOffCents: row.amountOffCents,
    tierOverrides: row.tierOverrides ?? [],
  };
}

export async function resolveCheckoutPricingInTx(
  tx: EntityTx,
  params: {
    eventId: string;
    selectedTiers: SelectedTier[];
    promotionCodeRaw: string | null | undefined;
    excludeOrderId?: string;
  },
): Promise<
  | { ok: true; pricing: ResolvedCheckoutPricing }
  | { ok: false; reason: ResolvePromotionFailureReason }
> {
  const baseLines: CheckoutPricingLine[] = params.selectedTiers.map((tier) => ({
    eventTierId: tier.id,
    unitPriceCents: tier.priceCents,
    currency: tier.currency,
  }));
  const subtotalCents = baseLines.reduce((sum, line) => sum + line.unitPriceCents, 0);

  const raw = params.promotionCodeRaw?.trim();
  if (!raw) {
    return {
      ok: true,
      pricing: {
        lines: baseLines,
        amountCents: subtotalCents,
        subtotalCents,
        discountCents: 0,
        promotionCodeId: null,
      },
    };
  }

  const normalized = normalizePromotionCode(raw);
  if (!normalized) {
    return { ok: false, reason: "invalid_promotion" };
  }

  const promo = await promotionCodesService.findActiveByEventAndCodeInTx(
    tx,
    params.eventId,
    normalized,
  );
  if (!promo) {
    return { ok: false, reason: "invalid_promotion" };
  }

  if (promo.maxRedemptions != null) {
    let used = await ordersService.countPendingOrPaidForPromotionCode(promo.id, tx);
    if (params.excludeOrderId) {
      const excluded = await ordersService.getInTx(tx, params.excludeOrderId);
      if (
        excluded &&
        excluded.promotionCodeId === promo.id &&
        (excluded.status === "pending" || excluded.status === "paid")
      ) {
        used = Math.max(0, used - 1);
      }
    }
    if (used >= promo.maxRedemptions) {
      return { ok: false, reason: "promotion_exhausted" };
    }
  }

  const applied = applyPromotionToLines({
    lines: baseLines,
    promotion: promotionRowToPricing(promo),
  });

  return {
    ok: true,
    pricing: {
      lines: applied.lines,
      amountCents: applied.amountCents,
      subtotalCents: applied.subtotalCents,
      discountCents: applied.discountCents,
      promotionCodeId: promo.id,
    },
  };
}
