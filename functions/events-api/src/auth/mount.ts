import type { Hono } from "hono";

import type { AdminEnv } from "./require-admin-session.js";
import { auth } from "./auth.js";
import { toPublicAuthRequest } from "./public-url.js";

/** Public `/admin/auth/*`; mounted on the admin sub-app as `/auth/*`. */
export function mountBetterAuth(admin: Hono<AdminEnv>): void {
  admin.on(["POST", "GET"], "/auth/*", (c) =>
    auth.handler(toPublicAuthRequest(c.req.raw, `/admin${c.req.path}`)),
  );
}
