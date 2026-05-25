import { and, eq, gte, lt, sql } from "drizzle-orm";

import { rateLimitAttempts } from "../db/schema";
import type { EntityTx } from "./transaction";
import { getDb } from "../db/index";

export const REGISTRATION_EXCHANGE_RATE_SCOPE = "registration_exchange";

export async function consumeRateLimitInTx(
  tx: EntityTx,
  params: {
    scope: string;
    key: string;
    windowMs: number;
    maxAttempts: number;
  },
): Promise<boolean> {
  const windowStart = new Date(Date.now() - params.windowMs);
  await tx
    .delete(rateLimitAttempts)
    .where(
      and(
        eq(rateLimitAttempts.scope, params.scope),
        eq(rateLimitAttempts.key, params.key),
        lt(rateLimitAttempts.createdAt, windowStart),
      ),
    );

  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(rateLimitAttempts)
    .where(
      and(
        eq(rateLimitAttempts.scope, params.scope),
        eq(rateLimitAttempts.key, params.key),
        gte(rateLimitAttempts.createdAt, windowStart),
      ),
    );

  if (count >= params.maxAttempts) {
    return false;
  }

  await tx.insert(rateLimitAttempts).values({
    scope: params.scope,
    key: params.key,
  });
  return true;
}

export async function consumeRateLimit(params: {
  scope: string;
  key: string;
  windowMs: number;
  maxAttempts: number;
}): Promise<boolean> {
  const db = getDb();
  return db.transaction((tx) => consumeRateLimitInTx(tx, params));
}
