/** Sliding-window limit for exchange attempts per client IP (6-char codes). */
const exchangeRateTimestamps = new Map<string, number[]>();
const EXCHANGE_RATE_WINDOW_MS = 15 * 60 * 1000;
const EXCHANGE_RATE_MAX_ATTEMPTS = 30;

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

export function consumeExchangeRateLimit(ip: string): boolean {
  const now = Date.now();
  let arr = exchangeRateTimestamps.get(ip) ?? [];
  arr = arr.filter((t) => now - t < EXCHANGE_RATE_WINDOW_MS);
  if (arr.length >= EXCHANGE_RATE_MAX_ATTEMPTS) {
    exchangeRateTimestamps.set(ip, arr);
    return false;
  }
  arr.push(now);
  exchangeRateTimestamps.set(ip, arr);
  return true;
}
