export type PromotionTierOverride = {
  eventTierId: string;
  priceCents: number;
};

export type PromotionKind = "percent_off" | "amount_off" | "tier_prices";

export type CheckoutPricingLine = {
  eventTierId: string;
  unitPriceCents: number;
  currency: string;
};

export type PromotionForPricing = {
  kind: PromotionKind;
  percentBps: number | null;
  amountOffCents: number | null;
  tierOverrides: PromotionTierOverride[];
};

export type ApplyPromotionResult = {
  lines: CheckoutPricingLine[];
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
};

const CODE_MIN_LEN = 4;
const CODE_MAX_LEN = 32;
const CODE_PATTERN = /^[A-Z0-9-]+$/;

export function normalizePromotionCode(raw: string | null | undefined): string | null {
  const normalized = raw?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
  if (normalized.length < CODE_MIN_LEN || normalized.length > CODE_MAX_LEN) {
    return null;
  }
  if (!CODE_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

export function validateTierOverrides(
  overrides: PromotionTierOverride[],
  eventTierIds: Set<string>,
): { ok: true } | { ok: false; reason: string } {
  if (overrides.length === 0) {
    return { ok: false, reason: "At least one tier override is required." };
  }
  const seen = new Set<string>();
  for (const row of overrides) {
    const tierId = row.eventTierId?.trim();
    if (!tierId) {
      return { ok: false, reason: "Each override must include an event tier." };
    }
    if (seen.has(tierId)) {
      return { ok: false, reason: "Duplicate tier in overrides." };
    }
    seen.add(tierId);
    if (!eventTierIds.has(tierId)) {
      return { ok: false, reason: "Unknown tier for this event." };
    }
    if (row.priceCents < 0) {
      return { ok: false, reason: "Override price cannot be negative." };
    }
  }
  return { ok: true };
}

function allocateDiscountAcrossLines(
  lines: CheckoutPricingLine[],
  discountCents: number,
): CheckoutPricingLine[] {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPriceCents, 0);
  if (subtotal <= 0 || discountCents <= 0) {
    return lines.map((line) => ({ ...line, unitPriceCents: Math.max(0, line.unitPriceCents) }));
  }
  const cappedDiscount = Math.min(discountCents, subtotal);
  const priced = lines.map((line) => {
    const share = Math.floor((line.unitPriceCents * cappedDiscount) / subtotal);
    return {
      ...line,
      unitPriceCents: Math.max(0, line.unitPriceCents - share),
      _share: share,
    };
  });
  const allocated = priced.reduce((sum, line) => sum + line._share, 0);
  let remainder = cappedDiscount - allocated;
  if (remainder > 0) {
    let maxIdx = 0;
    for (let i = 1; i < priced.length; i++) {
      if (priced[i]!.unitPriceCents > priced[maxIdx]!.unitPriceCents) {
        maxIdx = i;
      }
    }
    priced[maxIdx] = {
      ...priced[maxIdx]!,
      unitPriceCents: Math.max(0, priced[maxIdx]!.unitPriceCents - remainder),
      _share: priced[maxIdx]!._share + remainder,
    };
    remainder = 0;
  }
  return priced.map(({ _share: _, ...line }) => line);
}

export function applyPromotionToLines(params: {
  lines: CheckoutPricingLine[];
  promotion: PromotionForPricing;
}): ApplyPromotionResult {
  const listLines = params.lines.map((line) => ({ ...line }));
  const subtotalCents = listLines.reduce((sum, line) => sum + line.unitPriceCents, 0);

  if (params.promotion.kind === "tier_prices") {
    const overrideByTier = new Map(
      params.promotion.tierOverrides.map((row) => [row.eventTierId, row.priceCents]),
    );
    const adjusted = listLines.map((line) => {
      const override = overrideByTier.get(line.eventTierId);
      if (override === undefined) {
        return { ...line, unitPriceCents: Math.max(0, line.unitPriceCents) };
      }
      return { ...line, unitPriceCents: Math.max(0, override) };
    });
    const amountCents = adjusted.reduce((sum, line) => sum + line.unitPriceCents, 0);
    const discountCents = Math.max(0, subtotalCents - amountCents);
    return { lines: adjusted, amountCents, subtotalCents, discountCents };
  }

  let discountCents = 0;
  if (params.promotion.kind === "percent_off") {
    const bps = params.promotion.percentBps ?? 0;
    discountCents = Math.floor((subtotalCents * bps) / 10_000);
  } else if (params.promotion.kind === "amount_off") {
    discountCents = params.promotion.amountOffCents ?? 0;
  }
  discountCents = Math.min(discountCents, subtotalCents);
  discountCents = Math.max(0, discountCents);

  const adjusted =
    discountCents > 0
      ? allocateDiscountAcrossLines(listLines, discountCents)
      : listLines.map((line) => ({ ...line, unitPriceCents: Math.max(0, line.unitPriceCents) }));
  const amountCents = adjusted.reduce((sum, line) => sum + line.unitPriceCents, 0);
  return {
    lines: adjusted,
    amountCents,
    subtotalCents,
    discountCents: Math.max(0, subtotalCents - amountCents),
  };
}
