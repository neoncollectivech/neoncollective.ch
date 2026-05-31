import type { EventTier } from "@/helpers/eventsApi";

export function formatTierPrice(tier: EventTier): string {
  return `${(tier.priceCents / 100).toFixed(0)} ${tier.currency.toUpperCase()}`;
}

export function formatTierPriceChf(cents: number): string {
  return `CHF ${(cents / 100).toFixed(0)}`;
}

export function isAddonTier(tier: EventTier): boolean {
  return tier.selectionMode === "addon";
}

export function isExclusiveTier(tier: EventTier): boolean {
  return !isAddonTier(tier);
}

export function isSelectableTier(tier: EventTier): boolean {
  return tier.placesRemaining == null || tier.placesRemaining > 0;
}

export function formatPlacesRemaining(
  tier: EventTier,
  placesRemainingLabel: string,
  placesUnlimitedLabel: string,
  soldOutLabel: string,
): string {
  if (tier.placesRemaining === 0) {
    return soldOutLabel;
  }
  if (tier.placesRemaining == null) {
    return placesUnlimitedLabel;
  }

  return `${tier.placesRemaining} ${placesRemainingLabel}`;
}

/** Auto-pick when there is exactly one exclusive tier, or only one that still has capacity. */
export function defaultExclusiveTierId(tiers: EventTier[]): string | null {
  const exclusive = tiers.filter(isExclusiveTier);

  if (exclusive.length === 1) {
    return exclusive[0]!.id;
  }
  const selectableExclusive = exclusive.filter(isSelectableTier);

  if (selectableExclusive.length === 1) {
    return selectableExclusive[0]!.id;
  }

  return null;
}

export function summaryTeaser(
  summary: string | null,
  max = 160,
): string | null {
  const line = summary?.trim();

  if (!line) {
    return null;
  }
  if (line.length <= max) {
    return line;
  }

  return `${line.slice(0, max).trimEnd()}…`;
}

const SUMMARY_TEASER_MAX = 160;

export function hasEventAboutContent(
  summary: string | null,
  imageUrls: string[] | null | undefined,
): boolean {
  if (summary?.trim()) {
    return true;
  }

  return (imageUrls?.length ?? 0) > 1;
}

export function heroSummaryText(
  summary: string | null,
  hasAboutContent: boolean,
): string | null {
  const line = summary?.trim();

  if (!line) {
    return null;
  }
  if (hasAboutContent && line.length <= SUMMARY_TEASER_MAX) {
    return null;
  }
  if (hasAboutContent) {
    return summaryTeaser(line, SUMMARY_TEASER_MAX);
  }

  return line;
}

export type EventRegistrationStatus = "open" | "passed";

export function eventRegistrationStatus(
  startsAt: string | null,
): EventRegistrationStatus | null {
  if (!startsAt) {
    return "open";
  }
  const when = Date.parse(startsAt);

  if (Number.isNaN(when)) {
    return null;
  }

  return when < Date.now() ? "passed" : "open";
}
