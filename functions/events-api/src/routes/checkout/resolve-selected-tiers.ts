import { eventTiersService } from "../../services/event-tiers.service";
import type { EntityTx } from "../../services/transaction";

export type CheckoutTierFailureReason =
  | "tier_required"
  | "tiers_required"
  | "unknown_tier"
  | "invalid_exclusive_tier"
  | "invalid_addon_tier";

export type SelectedCheckoutTier = Awaited<
  ReturnType<typeof eventTiersService.listActiveForEvent>
>[number];

export function uniqueCheckoutAddonIds(ids: string[]): string[] {
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

export async function resolveSelectedCheckoutTiersInTx(
  tx: EntityTx,
  params: {
    eventId: string;
    exclusiveTierId: string;
    addonTierIds: string[];
  },
): Promise<
  | { ok: true; selectedTiers: SelectedCheckoutTier[] }
  | { ok: false; reason: CheckoutTierFailureReason }
> {
  const exclusiveTierId = params.exclusiveTierId.trim();
  const addonTierIds = uniqueCheckoutAddonIds(params.addonTierIds);
  const activeTiers = await eventTiersService.listActiveForEvent(params.eventId, tx);
  const hasExclusiveTiers = activeTiers.some((tier) => tier.selectionMode === "exclusive");

  if (hasExclusiveTiers && !exclusiveTierId) {
    return { ok: false, reason: "tier_required" };
  }
  if (!hasExclusiveTiers && addonTierIds.length === 0) {
    return { ok: false, reason: "tiers_required" };
  }

  const selectedIds = [...(exclusiveTierId ? [exclusiveTierId] : []), ...addonTierIds];
  const tierById = new Map(activeTiers.map((tier) => [tier.id, tier]));
  const selectedTiers: SelectedCheckoutTier[] = [];

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

  return { ok: true, selectedTiers };
}
