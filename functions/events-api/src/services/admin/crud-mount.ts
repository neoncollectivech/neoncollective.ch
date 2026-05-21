import { getDb } from "../db";

/** Admin `@neon/admin-crud` providers that need a Drizzle executor. */
export function getAdminCrudDb() {
  return getDb();
}
