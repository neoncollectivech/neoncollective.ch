import { getDb } from "../db/index";

/** Drizzle transaction handle shared across table-service *InTx methods. */
export type EntityTx = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export async function runTransaction<T>(fn: (tx: EntityTx) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(fn);
}
