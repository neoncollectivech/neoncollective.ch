import { getEventsApiEnv } from "../config/runtime-env";
import { DEFAULT_E2E_OTP } from "../config/e2e";
import {
  REGISTRATION_CODE_ALPHABET,
  REGISTRATION_CODE_LENGTH,
} from "../config/registration";
import { profileVerificationCodesService } from "../services/profile-verification-codes.service";
import { registrationExchangeCodesService } from "../services/registration-exchange-codes.service";
import { sha256Hex } from "./token";

/** Local E2E only — never active in production. */
export function isE2eTestMode(): boolean {
  return getEventsApiEnv().e2eTestMode;
}

export function e2eTestOtp(): string {
  const raw = getEventsApiEnv().e2eTestOtp || DEFAULT_E2E_OTP;
  if (raw.length !== REGISTRATION_CODE_LENGTH) {
    throw new Error(
      `E2E_TEST_OTP must be exactly ${REGISTRATION_CODE_LENGTH} characters.`,
    );
  }
  for (const ch of raw) {
    if (!REGISTRATION_CODE_ALPHABET.includes(ch as (typeof REGISTRATION_CODE_ALPHABET)[number])) {
      throw new Error(`E2E_TEST_OTP contains invalid character: ${ch}`);
    }
  }
  return raw;
}

/** Removes stale rows so the fixed E2E OTP can be re-issued (same `code_hash`). */
export async function e2eClearStaleOtpForCode(
  rawCode: string,
  opts?: { profileSessionId?: string },
): Promise<void> {
  if (!isE2eTestMode()) {
    return;
  }
  const codeHash = await sha256Hex(rawCode);
  await registrationExchangeCodesService.deleteByCodeHash(codeHash);
  await profileVerificationCodesService.deleteByCodeHashForE2e(codeHash, opts);
}
