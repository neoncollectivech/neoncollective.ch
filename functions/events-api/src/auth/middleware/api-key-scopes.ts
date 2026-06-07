import type { ApiKeyScope } from "../../config/api-keys";
import { apiKeyHasEveryScope } from "../../config/api-keys";
import { authFactory } from "../factory";
import type { EventApiKeyAuth } from "../resolvers/event-api-key";

export function apiKeyGrantsScopes(
  key: Pick<EventApiKeyAuth, "scopes">,
  required: readonly ApiKeyScope[],
): boolean {
  return apiKeyHasEveryScope(key, required);
}

/** Returns 404 when the Bearer key lacks required scopes (consistent with event mismatch). */
export function requireEventApiKeyScopes(...required: ApiKeyScope[]) {
  return authFactory.createMiddleware(async (c, next) => {
    const key = c.var.eventApiKey;
    if (!key || !apiKeyGrantsScopes(key, required)) {
      return c.json({ error: "Event not found." }, 404);
    }
    await next();
  });
}
