import type { Context } from "hono";

import type { AppEnv } from "./env";

export function readAuth(c: Context<AppEnv>) {
  return {
    adminSession: c.var.adminSession ?? null,
    participantSession: c.var.participantSession ?? null,
    eventApiKey: c.var.eventApiKey ?? null,
    stripeEvent: c.var.stripeEvent ?? null,
  };
}
