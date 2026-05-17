import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as authSchema from "./auth-schema.js";
import * as schema from "./schema.js";

const fullSchema = { ...schema, ...authSchema };

let _db: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required for events-api");
    }
    _client = postgres(url, { prepare: false, max: 10 });
    _db = drizzle(_client, { schema: fullSchema });
  }
  return _db;
}

/** Close the pooled Postgres client (CLI scripts should call before exit). */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end({ timeout: 5 });
    _client = null;
    _db = null;
  }
}

export { schema, authSchema, fullSchema };

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
