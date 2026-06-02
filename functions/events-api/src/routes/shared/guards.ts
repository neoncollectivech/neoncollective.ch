import type { Context } from "hono";

import { isDatabaseConfigured } from "../../services/db";

export function databaseUnavailableResponse(c: Context) {
  return c.json({ error: "Database not configured." }, 503);
}

export function requireDatabase(_c: Context): boolean {
  return isDatabaseConfigured();
}
