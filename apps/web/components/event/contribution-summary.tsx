"use client";

import type { EventTier } from "@/helpers/eventsApi";

import {
  formatTierPrice,
  formatTierPriceChf,
} from "@/helpers/event-tier-utils";

type ContributionSummaryProps = {
  selectedTiers: EventTier[];
  displayTotalCents: number;
  promo: string | undefined;
  showPromoSubtotal: boolean;
  previewSubtotalCents: number | undefined;
  previewDiscountCents: number | undefined;
  promoInvalid: boolean;
  /** Omit top border when embedded in pending panel (section already divided). */
  unbordered?: boolean;
  labels: {
    promoCodeLabel: string;
    checkoutSubtotal: string;
    checkoutYourShare: string;
    promoDiscount: string;
    promoInvalid: string;
  };
};

export function ContributionSummary({
  selectedTiers,
  displayTotalCents,
  promo,
  showPromoSubtotal,
  previewSubtotalCents,
  previewDiscountCents,
  promoInvalid,
  unbordered = false,
  labels,
}: ContributionSummaryProps) {
  if (selectedTiers.length === 0) {
    return null;
  }

  return (
    <div
      className={
        unbordered
          ? "space-y-3"
          : "space-y-3 border-t border-foreground/10 pt-8"
      }
      data-testid="contribution-summary"
    >
      {promo ? (
        <p className="text-xs font-mono uppercase tracking-wider text-foreground/40 break-all">
          {labels.promoCodeLabel}: {promo}
        </p>
      ) : null}
      <ul className="space-y-1.5 text-sm text-foreground/80">
        {selectedTiers.map((tier) => (
          <li
            key={tier.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
          >
            <span>{tier.name}</span>
            <span className="text-xs font-mono text-foreground/45">
              {formatTierPrice(tier)}
            </span>
          </li>
        ))}
      </ul>
      {showPromoSubtotal && previewSubtotalCents != null ? (
        <p className="checkout-helper text-foreground/45 line-through">
          {labels.checkoutSubtotal}: {formatTierPriceChf(previewSubtotalCents)}
        </p>
      ) : null}
      {showPromoSubtotal && previewDiscountCents != null ? (
        <p className="text-sm text-neon/80">
          {labels.promoDiscount}: {formatTierPriceChf(previewDiscountCents)}
        </p>
      ) : null}
      <p className="text-sm font-semibold text-foreground/90">
        {labels.checkoutYourShare}:{" "}
        <span className="font-mono font-normal text-foreground/70">
          {formatTierPriceChf(displayTotalCents)}
        </span>
      </p>
      {promoInvalid ? (
        <p className="text-xs text-red-400">{labels.promoInvalid}</p>
      ) : null}
    </div>
  );
}
