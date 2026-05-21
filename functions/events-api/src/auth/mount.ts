import type { Hono } from "hono";

import { auth } from "./auth";
import { toPublicAuthRequest } from "./public-url";

/** Public `/admin/auth/*` on the root app (same CDN prefix as `/admin/events`). */
export function mountBetterAuth(app: Hono): void {
  app.on(["POST", "GET"], "/admin/auth/*", (c) =>
    auth.handler(toPublicAuthRequest(c.req.raw, c.req.path)),
  );
}
