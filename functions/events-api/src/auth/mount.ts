import type { Hono } from "hono";

import type { AppEnv } from "./env";
import type { BetterAuthInstance } from "./auth";
import { getEventsApiEnv } from "../config/runtime-env";
import { toPublicAuthRequest } from "./public-url";

/** Public `/admin/auth/*` on the root app (same CDN prefix as `/admin/events`). */
export function mountBetterAuth(app: Hono<AppEnv>, auth: BetterAuthInstance): void {
  const publicUrl = getEventsApiEnv().eventsApiPublicUrl;
  app.on(["POST", "GET"], "/admin/auth/*", (c) =>
    auth.handler(toPublicAuthRequest(c.req.raw, c.req.path, publicUrl)),
  );
}
