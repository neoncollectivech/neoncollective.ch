import { sha256Hex } from "../../helpers/token";
import {
  REGISTRATION_EXCHANGE_RATE_SCOPE,
  REGISTRATION_REQUEST_CONTACT_RATE_MAX_ATTEMPTS,
  REGISTRATION_REQUEST_CONTACT_RATE_SCOPE,
  REGISTRATION_REQUEST_CONTACT_RATE_WINDOW_MS,
  REGISTRATION_REQUEST_RATE_MAX_ATTEMPTS,
  REGISTRATION_REQUEST_RATE_SCOPE,
  REGISTRATION_REQUEST_RATE_WINDOW_MS,
} from "../../config/registration";
import { consumeRateLimit } from "../../services/rate-limit.service";

/** Sliding-window limit for exchange attempts per client IP. */
export const EXCHANGE_RATE_WINDOW_MS = 15 * 60 * 1000;
export const EXCHANGE_RATE_MAX_ATTEMPTS = 30;

export function clientIpForRateLimit(c: {
  req: { header: (n: string) => string | undefined };
}): string {
  const cf = c.req.header("cf-connecting-ip")?.trim();
  if (cf) {
    return cf;
  }
  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
}

export async function hashContactForRateLimit(contact: string): Promise<string> {
  return sha256Hex(contact.trim().toLowerCase());
}

export async function consumeExchangeRateLimit(ip: string): Promise<boolean> {
  return consumeRateLimit({
    scope: REGISTRATION_EXCHANGE_RATE_SCOPE,
    key: ip,
    windowMs: EXCHANGE_RATE_WINDOW_MS,
    maxAttempts: EXCHANGE_RATE_MAX_ATTEMPTS,
  });
}

export async function consumeRegistrationRequestRateLimit(
  ip: string,
  contactHash: string,
): Promise<boolean> {
  const ipOk = await consumeRateLimit({
    scope: REGISTRATION_REQUEST_RATE_SCOPE,
    key: ip,
    windowMs: REGISTRATION_REQUEST_RATE_WINDOW_MS,
    maxAttempts: REGISTRATION_REQUEST_RATE_MAX_ATTEMPTS,
  });
  if (!ipOk) {
    return false;
  }
  return consumeRateLimit({
    scope: REGISTRATION_REQUEST_CONTACT_RATE_SCOPE,
    key: contactHash,
    windowMs: REGISTRATION_REQUEST_CONTACT_RATE_WINDOW_MS,
    maxAttempts: REGISTRATION_REQUEST_CONTACT_RATE_MAX_ATTEMPTS,
  });
}
