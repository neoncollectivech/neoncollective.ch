import { and, eq } from "drizzle-orm";

import { getDb } from "./db/index";
import {
  profileVerificationCodes,
  registrationExchangeCodes,
} from "./db/schema";
import {
  REGISTRATION_CODE_ALPHABET,
  REGISTRATION_CODE_LENGTH,
} from "./registration-exchange-constants";
import { sha256Hex } from "./token";

const DEFAULT_E2E_OTP = "EEEEEE";

/** Local E2E only — never active in production. */
export function isE2eTestMode(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.E2E_TEST_MODE === "1";
}

export function e2eTestOtp(): string {
  const raw = process.env.E2E_TEST_OTP?.trim() || DEFAULT_E2E_OTP;
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
  const codeHash = sha256Hex(rawCode);
  const db = getDb();
  await db
    .delete(registrationExchangeCodes)
    .where(eq(registrationExchangeCodes.codeHash, codeHash));
  if (opts?.profileSessionId) {
    await db
      .delete(profileVerificationCodes)
      .where(
        and(
          eq(profileVerificationCodes.codeHash, codeHash),
          eq(profileVerificationCodes.sessionId, opts.profileSessionId),
        ),
      );
  } else {
    await db
      .delete(profileVerificationCodes)
      .where(eq(profileVerificationCodes.codeHash, codeHash));
  }
}
