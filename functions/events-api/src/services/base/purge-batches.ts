import { inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import {
  MAINTENANCE_DELETE_BATCH_SIZE,
  MAINTENANCE_MAX_BATCH_PASSES,
} from "../../config/maintenance";
import { stripeEventsProcessed } from "../../db/schema";
import { getDb } from "../db";

export async function countRowsWhere(
  table: PgTable,
  where: SQL,
): Promise<number> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return count;
}

export async function purgeIdTableInBatches<
  TTable extends PgTable & { id: AnyPgColumn },
>(
  table: TTable,
  idColumn: TTable["id"],
  where: SQL,
): Promise<number> {
  const db = getDb();
  let total = 0;

  for (let pass = 0; pass < MAINTENANCE_MAX_BATCH_PASSES; pass++) {
    const rows = await db
      .select({ id: idColumn })
      .from(table)
      .where(where)
      .limit(MAINTENANCE_DELETE_BATCH_SIZE);

    if (rows.length === 0) {
      break;
    }

    const ids = rows.map((r) => r.id as string);
    const result = await db.delete(table).where(inArray(idColumn, ids));
    const deleted = result.rowCount ?? rows.length;
    total += deleted;

    if (rows.length < MAINTENANCE_DELETE_BATCH_SIZE) {
      break;
    }
  }

  return total;
}

export async function purgeStripeEventsInBatches(where: SQL): Promise<number> {
  const db = getDb();
  let total = 0;

  for (let pass = 0; pass < MAINTENANCE_MAX_BATCH_PASSES; pass++) {
    const rows = await db
      .select({ stripeEventId: stripeEventsProcessed.stripeEventId })
      .from(stripeEventsProcessed)
      .where(where)
      .limit(MAINTENANCE_DELETE_BATCH_SIZE);

    if (rows.length === 0) {
      break;
    }

    const ids = rows.map((r) => r.stripeEventId);
    const result = await db
      .delete(stripeEventsProcessed)
      .where(inArray(stripeEventsProcessed.stripeEventId, ids));
    const deleted = result.rowCount ?? rows.length;
    total += deleted;

    if (rows.length < MAINTENANCE_DELETE_BATCH_SIZE) {
      break;
    }
  }

  return total;
}
