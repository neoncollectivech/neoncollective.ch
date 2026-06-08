import type { Context } from "hono";

import type { AppEnv } from "./env";

export const EVENT_API_KEY_QUERY_PARAM = "apiKey";

/** Bearer `Authorization` first; `?apiKey=` on GET requests only. */
export function extractEventApiKeyToken(c: Context<AppEnv>): string | null {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) {
      return token;
    }
  }

  if (c.req.method !== "GET") {
    return null;
  }

  const queryToken = c.req.query(EVENT_API_KEY_QUERY_PARAM)?.trim();
  return queryToken || null;
}
