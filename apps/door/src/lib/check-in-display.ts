export type CheckInGuestDisplay = {
  guestName: string;
  tiers: string;
};

export type CheckInResponse = {
  ok: true;
} & CheckInGuestDisplay;

export function parseCheckInGuestFromError(
  data: unknown,
): CheckInGuestDisplay | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;
  const guestName =
    typeof row.guestName === "string" ? row.guestName.trim() : "";
  const tiers = typeof row.tiers === "string" ? row.tiers.trim() : "";

  if (!guestName) {
    return null;
  }

  return { guestName, tiers };
}
