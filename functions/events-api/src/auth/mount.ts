import type { Hono } from "hono";

import { auth } from "./auth.js";
import { toPublicAuthRequest } from "./public-url.js";

/** Public `/admin/auth/*` on the root app (same CDN prefix as `/admin/events`). */
export function mountBetterAuth(app: Hono): void {
  app.on(["POST", "GET"], "/admin/auth/*", (c) =>
    auth.handler(toPublicAuthRequest(c.req.raw, c.req.path)),
  );
}
