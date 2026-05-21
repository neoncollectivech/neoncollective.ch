import { Hono } from "hono";

import { isDatabaseConfigured } from "../services/db";

export function createHealthRouter(): Hono {
  const router = new Hono();

  router.get("/health", (c) => {
    return c.json({
      ok: true,
      database: isDatabaseConfigured(),
    });
  });

  return router;
}
