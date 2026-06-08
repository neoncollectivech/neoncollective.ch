import type { Context } from "hono";

import { extractEventApiKeyToken } from "../event-api-key-token";
import type { AppEnv } from "../env";
import { authFactory } from "../factory";
import { resolveEventApiKey } from "../resolvers/event-api-key";

async function authenticateEventApiKey(c: Context<AppEnv>): Promise<boolean> {
  const token = extractEventApiKeyToken(c);
  if (!token) {
    return false;
  }
  const auth = await resolveEventApiKey(token);
  if (!auth) {
    return false;
  }
  c.set("eventApiKey", auth);
  return true;
}

/** Required API key auth (Bearer header; GET also accepts `?apiKey=`). */
export const eventApiKeyBearerAuth = authFactory.createMiddleware(async (c, next) => {
  if (!(await authenticateEventApiKey(c))) {
    return c.text("Unauthorized", 401);
  }
  await next();
});
