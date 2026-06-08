export const SUMUP_APP_SWITCH_READER_ID = "app-switch";

export function isSumUpAppSwitchReader(readerId: string | null | undefined): boolean {
  return readerId?.trim() === SUMUP_APP_SWITCH_READER_ID;
}

export function sumUpAppSwitchCallbackBase(): string {
  const base = process.env.SUMUP_APP_SWITCH_CALLBACK_BASE?.trim();
  if (!base) {
    throw new Error("SUMUP_APP_SWITCH_CALLBACK_BASE is not configured.");
  }
  if (!base.startsWith("https://")) {
    throw new Error("SUMUP_APP_SWITCH_CALLBACK_BASE must be an https URL.");
  }
  return base.replace(/\/$/, "");
}

export function sumUpAppSwitchAndroidAppId(): string | undefined {
  const id = process.env.SUMUP_APP_SWITCH_ANDROID_APP_ID?.trim();
  return id || undefined;
}

export function isSumUpAppSwitchConfigured(): boolean {
  return Boolean(process.env.SUMUP_APP_SWITCH_CALLBACK_BASE?.trim());
}
