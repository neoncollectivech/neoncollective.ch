import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";

function tryParseEnvOrigin(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  try {
    return new URL(t).origin;
  } catch {
    return null;
  }
}

/**
 * Origins allowed when the browser sends `credentials: true` (cookies).
 * Concrete echo of `Origin` is required — `*` is invalid for credentialed requests.
 * Includes localhost ↔ 127.0.0.1 mirrors for local dev.
 */
export function allowedCorsOriginsForSite(): string[] {
  const set = new Set<string>();
  const addFromCsv = (env: string | undefined) => {
    if (!env?.trim()) {
      return;
    }
    for (const part of env.split(",")) {
      const o = tryParseEnvOrigin(part);
      if (o) {
        set.add(o);
      }
    }
  };
  const pub = tryParseEnvOrigin(process.env.PUBLIC_SITE_URL);
  if (pub) {
    set.add(pub);
  }
  addFromCsv(process.env.EVENTS_ALLOWED_ORIGIN);
  addFromCsv(process.env.ADMIN_ALLOWED_ORIGIN);
  addFromCsv(process.env.ALLOWED_ORIGIN);
  for (const o of [...set]) {
    try {
      const u = new URL(o);
      if (u.hostname === "localhost") {
        const mirror = new URL(o);
        mirror.hostname = "127.0.0.1";
        set.add(mirror.origin);
      } else if (u.hostname === "127.0.0.1") {
        const mirror = new URL(o);
        mirror.hostname = "localhost";
        set.add(mirror.origin);
      }
    } catch {
      // ignore
    }
  }
  if (set.size === 0) {
    set.add("http://localhost:3000");
    set.add("http://127.0.0.1:3000");
  }
  return [...set];
}

export type CorsEnvMode = "simple" | "credentials";

/**
 * CORS from environment: `simple` matches a single `ALLOWED_ORIGIN` or `*`;
 * `credentials` uses multi-origin discovery (PUBLIC_SITE_URL, EVENTS_ALLOWED_ORIGIN, ALLOWED_ORIGIN).
 */
export function createCorsFromEnv(mode: CorsEnvMode): MiddlewareHandler {
  if (mode === "simple") {
    const o = process.env.ALLOWED_ORIGIN?.trim();
    return cors({
      origin: o && o.length > 0 ? o : "*",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    });
  }
  return cors({
    origin: allowedCorsOriginsForSite(),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true,
  });
}
