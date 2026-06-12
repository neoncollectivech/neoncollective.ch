import type { Context } from "hono";

import type { AppEnv } from "../../auth/env";
import { SumUpApiError } from "../../helpers/sumup";

export function jsonFromSumUpError(
  c: Context<AppEnv>,
  error: unknown,
  fallback: string,
) {
  if (error instanceof SumUpApiError) {
    return c.json({ error: error.message }, error.httpStatus);
  }
  const msg = error instanceof Error ? error.message : fallback;
  return c.json({ error: msg }, 502);
}
