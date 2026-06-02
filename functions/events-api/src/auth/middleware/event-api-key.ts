import { bearerAuth } from "hono/bearer-auth";
import type { Context } from "hono";

import type { AppEnv } from "../env";
import { resolveEventApiKey } from "../resolvers/event-api-key";

/** Required Bearer auth for check-in and event API key routes. */
export const eventApiKeyBearerAuth = bearerAuth({
  verifyToken: async (token, c) => {
    const ctx = c as Context<AppEnv>;
    const auth = await resolveEventApiKey(token);
    if (!auth) {
      return false;
    }
    ctx.set("eventApiKey", auth);
    return true;
  },
});
