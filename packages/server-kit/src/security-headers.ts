import type { MiddlewareHandler } from "hono";

/** Conservative security headers for JSON API responses. */
export function createSecurityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");

    if (process.env.NODE_ENV === "production") {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    await next();
  };
}
