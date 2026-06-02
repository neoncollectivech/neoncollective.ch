import { bearerAuth } from "hono/bearer-auth";
import type { Context } from "hono";

import { getEventsApiEnv } from "../../config/runtime-env";
import type { AppEnv } from "../env";
import { resolveEventApiKey } from "../resolvers/event-api-key";

/** Required Bearer auth for check-in and future event-scoped API key routes. */
export const eventApiKeyBearerAuth = bearerAuth({
  verifyToken: async (token, c) => {
    const ctx = c as Context<AppEnv>;
    const auth = await resolveEventApiKey(token);
    if (auth) {
      ctx.set("eventApiKey", auth);
      return true;
    }
    const staff = getEventsApiEnv().staffCheckinToken;
    return Boolean(staff && token === staff);
  },
});
