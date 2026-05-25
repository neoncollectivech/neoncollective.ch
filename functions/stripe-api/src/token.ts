import { createLogger, hmacSha256Hex, timingSafeEqualHex } from "@neon/server-kit";

import { getStripeApiEnv } from "./config/runtime-env";

const log = createLogger("token");

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function magicLinkSecret(): string | undefined {
  return getStripeApiEnv().magicLinkSecret;
}

/**
 * Create an HMAC-signed magic link token.
 * Payload: email|expiry  →  signed with HMAC-SHA256.
 */
export async function createToken(email: string): Promise<{
  token: string;
  email: string;
  exp: string;
}> {
  const secret = magicLinkSecret();
  if (!secret) {
    throw new Error("MAGIC_LINK_SECRET not set");
  }
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const data = `${email}|${exp}`;
  const token = await hmacSha256Hex(secret, data);

  log.debug({ email }, "Token created");

  return { token, email, exp };
}

/**
 * Verify an HMAC-signed magic link token.
 * Returns true if the signature is valid and the token has not expired.
 */
export async function verifyToken(
  token: string,
  email: string,
  exp: string,
): Promise<boolean> {
  const secret = magicLinkSecret();
  if (!secret) {
    log.warn("MAGIC_LINK_SECRET not set — magic link tokens will fail");
    return false;
  }
  if (Date.now() > Number(exp)) {
    log.debug({ email }, "Token expired");

    return false;
  }

  const data = `${email}|${exp}`;
  const expected = await hmacSha256Hex(secret, data);
  const valid = timingSafeEqualHex(token, expected);

  log.debug({ email, valid }, "Token verified");

  return valid;
}
