import { sha256Hex } from "@neon/server-kit";

import {
  e2eClearStaleOtpForCode,
  e2eTestOtp,
  isE2eTestMode,
} from "./e2e-test-mode";
import {
  REGISTRATION_CODE_ALPHABET,
  REGISTRATION_CODE_LENGTH,
} from "../config/registration";

const ALPHABET_LEN = REGISTRATION_CODE_ALPHABET.length;

export function randomRegistrationExchangeCode(): string {
  const bytes = new Uint8Array(REGISTRATION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < REGISTRATION_CODE_LENGTH; i++) {
    s += REGISTRATION_CODE_ALPHABET[bytes[i]! % ALPHABET_LEN]!;
  }
  return s;
}

export function normalizeRegistrationExchangeCodeInput(raw: string): string | null {
  const t = raw.trim().replace(/[\s-]+/g, "");
  if (t.length !== REGISTRATION_CODE_LENGTH) {
    return null;
  }
  const upper = t.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    if (!REGISTRATION_CODE_ALPHABET.includes(upper[i]!)) {
      return null;
    }
  }
  return upper;
}

/** Human-readable OTP (e.g. `4K8H-9M2P`) for email, SMS, and UI. */
export function formatOtpDisplayCode(raw: string): string {
  const normalized = normalizeRegistrationExchangeCodeInput(raw);
  if (!normalized) {
    return raw;
  }
  const half = Math.floor(normalized.length / 2);
  return `${normalized.slice(0, half)}-${normalized.slice(half)}`;
}

export function issueRawOtpCode(): string {
  return isE2eTestMode() ? e2eTestOtp() : randomRegistrationExchangeCode();
}

export async function hashOtpCode(raw: string): Promise<string> {
  return sha256Hex(raw);
}

export async function clearStaleOtpForCode(
  rawCode: string,
  options?: { profileSessionId?: string },
): Promise<void> {
  await e2eClearStaleOtpForCode(rawCode, options);
}
