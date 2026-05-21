/** Sellable headcount left for a tier. `tierQuota === null` means no tier cap (only event-level quota applies). */
export function computeTierPlacesRemaining(params: {
  tierQuota: number | null;
  sold: number;
  eventRemaining: number | null;
}): number | null {
  const tierCap =
    params.tierQuota == null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, params.tierQuota - params.sold);
  if (params.eventRemaining != null) {
    const n = Math.min(tierCap, params.eventRemaining);
    return Number.isFinite(n) ? n : params.eventRemaining;
  }
  if (tierCap === Number.POSITIVE_INFINITY) {
    return null;
  }
  return tierCap;
}
