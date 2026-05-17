import type { Hono } from "hono";

import { auth } from "./auth.js";
import { toPublicAuthRequest } from "./public-url.js";

/** Mount Better Auth handler at `/api/auth/*`. */
export function mountBetterAuth(app: Hono): void {
  app.on(["POST", "GET"], "/api/auth/*", (c) =>
    auth.handler(toPublicAuthRequest(c.req.raw)),
  );
}
