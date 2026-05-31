"use client";

import { NeonButton } from "@/components/neon-button";

type StickyContributionBarProps = {
  summaryLabel: string;
  ctaLabel: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
};

export function StickyContributionBar({
  summaryLabel,
  ctaLabel,
  disabled,
  busy,
  onPress,
}: StickyContributionBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 backdrop-blur-md p-4 md:hidden"
      data-testid="sticky-contribution-bar"
    >
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <p className="flex-1 min-w-0 text-xs font-mono text-foreground/50 truncate">
          {summaryLabel}
        </p>
        <NeonButton
          className="shrink-0"
          data-testid="event-checkout-confirm-contribution-sticky"
          isDisabled={disabled || busy}
          type="button"
          onPress={onPress}
        >
          {busy ? "…" : ctaLabel}
        </NeonButton>
      </div>
    </div>
  );
}
