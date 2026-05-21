import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function jsonReasonFailure<R extends string>(
  c: Context,
  failure: { reason: R; message?: string; tierName?: string },
  map: Record<R, { status: ContentfulStatusCode; error: string }>,
): Response {
  const entry = map[failure.reason];
  let error = failure.message ?? entry.error;
  if (failure.reason === "tier_sold_out" && failure.tierName) {
    error = `Not enough places remaining for "${failure.tierName}".`;
  }
  return c.json({ error }, entry.status);
}
