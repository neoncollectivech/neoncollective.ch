export const SUMUP_APP_SWITCH_READER_ID = "app-switch";
export const SUMUP_APP_SWITCH_READER_NAME = "Tap to Pay";

export function isSumUpAppSwitchReader(
  readerId: string | null | undefined,
): boolean {
  return readerId?.trim() === SUMUP_APP_SWITCH_READER_ID;
}

export function detectSumUpPlatform(): "ios" | "android" {
  if (/android/i.test(navigator.userAgent)) {
    return "android";
  }

  return "ios";
}

export const PENDING_APP_SWITCH_ORDER_KEY = "neon:door:pendingAppSwitchOrder";
export const PENDING_APP_SWITCH_HANDOFF_KEY =
  "neon:door:pendingAppSwitchHandoffUrl";
