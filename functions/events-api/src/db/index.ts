import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { getEventsApiEnv } from "../config/runtime-env";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";
import * as views from "./views";

const fullSchema = { ...schema, ...authSchema, ...views };

neonConfig.webSocketConstructor = ws;

let _db: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;
let _pool: Pool | null = null;

export function getDb() {
  if (!_db) {
    const url = getEventsApiEnv().databaseUrl;
    if (!url) {
      throw new Error("DATABASE_URL is required for events-api");
    }
    _pool = new Pool({ connectionString: url });
    _db = drizzle({ client: _pool, schema: fullSchema });
  }
  return _db;
}

/** Close the pooled Postgres client (CLI scripts should call before exit). */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

export { schema, authSchema, fullSchema };

export function isDatabaseConfigured(): boolean {
  return Boolean(getEventsApiEnv().databaseUrl);
}
