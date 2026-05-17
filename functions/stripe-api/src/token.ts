import { createHmac, timingSafeEqual } from "node:crypto";

import { createLogger } from "@neon/server-kit";

const log = createLogger("token");

const SECRET = process.env.MAGIC_LINK_SECRET;
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

if (!SECRET) {
  log.warn("MAGIC_LINK_SECRET not set — magic link tokens will fail");
}

/**
 * Create an HMAC-signed magic link token.
 * Payload: email|expiry  →  signed with HMAC-SHA256.
 */
export function createToken(email: string): {
  token: string;
  email: string;
  exp: string;
} {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const data = `${email}|${exp}`;
  const token = createHmac("sha256", SECRET!).update(data).digest("hex");

  log.debug({ email }, "Token created");

  return { token, email, exp };
}

/**
 * Verify an HMAC-signed magic link token.
 * Returns true if the signature is valid and the token has not expired.
 */
export function verifyToken(
  token: string,
  email: string,
  exp: string,
): boolean {
  if (Date.now() > Number(exp)) {
    log.debug({ email }, "Token expired");

    return false;
  }

  const data = `${email}|${exp}`;
  const expected = createHmac("sha256", SECRET!).update(data).digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    const valid = timingSafeEqual(Buffer.from(token), Buffer.from(expected));

    log.debug({ email, valid }, "Token verified");

    return valid;
  } catch {
    log.debug({ email }, "Token verification failed (length mismatch)");

    return false;
  }
}
