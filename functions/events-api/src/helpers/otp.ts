import { randomBytes } from "node:crypto";

import {
  e2eClearStaleOtpForCode,
  e2eTestOtp,
  isE2eTestMode,
} from "./e2e-test-mode";
import {
  REGISTRATION_CODE_ALPHABET,
  REGISTRATION_CODE_LENGTH,
} from "../config/registration";
import { sha256Hex } from "./token";

const ALPHABET_LEN = REGISTRATION_CODE_ALPHABET.length;

export function randomRegistrationExchangeCode(): string {
  const bytes = randomBytes(REGISTRATION_CODE_LENGTH);
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

export function issueRawOtpCode(): string {
  return isE2eTestMode() ? e2eTestOtp() : randomRegistrationExchangeCode();
}

export function hashOtpCode(raw: string): string {
  return sha256Hex(raw);
}

export async function clearStaleOtpForCode(
  rawCode: string,
  options?: { profileSessionId?: string },
): Promise<void> {
  await e2eClearStaleOtpForCode(rawCode, options);
}
