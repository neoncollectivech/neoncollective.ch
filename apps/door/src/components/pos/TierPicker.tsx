import type { PosTier } from "@/lib/pos-api";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

type TierPickerProps = {
  tiers: PosTier[];
  exclusiveTierId: string;
  addonTierIds: string[];
  addonOnly: boolean;
  onExclusiveChange: (tierId: string) => void;
  onAddonToggle: (tierId: string) => void;
};

export function TierPicker({
  tiers,
  exclusiveTierId,
  addonTierIds,
  addonOnly,
  onExclusiveChange,
  onAddonToggle,
}: TierPickerProps) {
  const exclusiveTiers = tiers.filter((t) => t.selectionMode === "exclusive");
  const addonTiers = tiers.filter((t) => t.selectionMode === "addon");

  return (
    <div className="space-y-4">
      {!addonOnly ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Admission tier</p>
          {exclusiveTiers.map((tier) => (
            <Button
              key={tier.id}
              className={cn(
                "h-auto w-full flex-col items-start gap-1 py-3",
                exclusiveTierId === tier.id && "ring-2 ring-primary",
              )}
              type="button"
              variant={exclusiveTierId === tier.id ? "default" : "outline"}
              onClick={() => onExclusiveChange(tier.id)}
            >
              <span className="font-medium">{tier.name}</span>
              <span className="text-xs opacity-80">
                {formatPrice(tier.priceCents, tier.currency)}
                {tier.placesRemaining != null
                  ? ` · ${tier.placesRemaining} left`
                  : ""}
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      {addonTiers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Add-ons</p>
          {(addonOnly ? addonTiers : addonTiers).map((tier) => {
            const selected = addonTierIds.includes(tier.id);
            const disabled =
              addonOnly &&
              tier.placesRemaining != null &&
              tier.placesRemaining < 1;

            return (
              <Button
                key={tier.id}
                className={cn(
                  "h-auto w-full flex-col items-start gap-1 py-3",
                  selected && "ring-2 ring-primary",
                )}
                disabled={disabled}
                type="button"
                variant={selected ? "default" : "outline"}
                onClick={() => onAddonToggle(tier.id)}
              >
                <span className="font-medium">{tier.name}</span>
                <span className="text-xs opacity-80">
                  {formatPrice(tier.priceCents, tier.currency)}
                  {tier.placesRemaining != null
                    ? ` · ${tier.placesRemaining} left`
                    : ""}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
