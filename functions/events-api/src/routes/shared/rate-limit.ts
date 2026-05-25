import {
  consumeRateLimit,
  REGISTRATION_EXCHANGE_RATE_SCOPE,
} from "../../services/rate-limit.service";

/** Sliding-window limit for exchange attempts per client IP (6-char codes). */
export const EXCHANGE_RATE_WINDOW_MS = 15 * 60 * 1000;
export const EXCHANGE_RATE_MAX_ATTEMPTS = 30;

export function clientIpForRateLimit(c: {
  req: { header: (n: string) => string | undefined };
}): string {
  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return c.req.header("cf-connecting-ip") ?? "unknown";
}

export async function consumeExchangeRateLimit(ip: string): Promise<boolean> {
  return consumeRateLimit({
    scope: REGISTRATION_EXCHANGE_RATE_SCOPE,
    key: ip,
    windowMs: EXCHANGE_RATE_WINDOW_MS,
    maxAttempts: EXCHANGE_RATE_MAX_ATTEMPTS,
  });
}
