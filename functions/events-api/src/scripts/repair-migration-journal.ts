/**
 * Repairs `drizzle.__drizzle_migrations` when the DB schema was applied outside
 * drizzle migrate (push, manual SQL, or journal loss). Prevents migrate from replaying
 * 0000 and failing on existing types/tables.
 *
 * Local:  pnpm db:events-api:repair-migrations:local
 * Prod:   DATABASE_URL="postgresql://…" pnpm db:events-api:repair-migrations
 */

import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../../drizzle");

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

async function columnExists(
  client: postgres.Sql,
  table: string,
  column: string,
): Promise<boolean> {
  const [row] = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
    ) AS exists
  `;
  return Boolean(row?.exists);
}

async function tableExists(client: postgres.Sql, table: string): Promise<boolean> {
  const [row] = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${table}
    ) AS exists
  `;
  return Boolean(row?.exists);
}

async function indexExists(client: postgres.Sql, indexName: string): Promise<boolean> {
  const [row] = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ${indexName}
    ) AS exists
  `;
  return Boolean(row?.exists);
}

/** One admission per order; keep active/checked-in/newest when duplicates exist (double-fulfill). */
async function deduplicateAdmissionsByOrderId(client: postgres.Sql): Promise<number> {
  const removed = await client`
    DELETE FROM admissions a
    WHERE a.id IN (
      SELECT id
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY
              (revoked_at IS NULL) DESC,
              checked_in_at DESC NULLS LAST,
              created_at DESC
          ) AS rn
        FROM admissions
      ) ranked
      WHERE rn > 1
    )
  `;
  return removed.count;
}

async function applyCheckoutFulfillmentMigration(client: postgres.Sql): Promise<void> {
  const dupesRemoved = await deduplicateAdmissionsByOrderId(client);
  if (dupesRemoved > 0) {
    console.log(`Removed ${dupesRemoved} duplicate admission row(s) before unique index.`);
  }

  if (!(await columnExists(client, "orders", "checkout_fulfilled_at"))) {
    await client.unsafe(
      `ALTER TABLE "orders" ADD COLUMN "checkout_fulfilled_at" timestamp with time zone`,
    );
  }
  if (!(await columnExists(client, "orders", "access_email_sent_at"))) {
    await client.unsafe(
      `ALTER TABLE "orders" ADD COLUMN "access_email_sent_at" timestamp with time zone`,
    );
  }

  await client.unsafe(`
    UPDATE "orders"
    SET "checkout_fulfilled_at" = "updated_at"
    WHERE "status" = 'paid' AND "checkout_fulfilled_at" IS NULL
  `);

  if (!(await indexExists(client, "admissions_order_id_unique"))) {
    await client.unsafe(
      `CREATE UNIQUE INDEX "admissions_order_id_unique" ON "admissions" USING btree ("order_id")`,
    );
  }
}

async function appliedHashes(client: postgres.Sql): Promise<Set<string>> {
  await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await client`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
  const rows = await client<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations
  `;
  return new Set(rows.map((r) => r.hash));
}

async function recordMigration(client: postgres.Sql, hash: string, createdAt: number) {
  const existing = await client<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1
  `;
  if (existing.length > 0) {
    return;
  }
  await client`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash}, ${createdAt})
  `;
}

async function runMigrationStatements(
  client: postgres.Sql,
  statements: string[],
): Promise<void> {
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) {
      continue;
    }
    await client.unsafe(trimmed);
  }
}

/** True when 0001 (multi-tier / order_tiers) is already on the database. */
async function hasPost0001Schema(client: postgres.Sql): Promise<boolean> {
  return columnExists(client, "event_tiers", "selection_mode");
}

/** True when 0002 columns exist (may still be missing the unique index after a partial apply). */
async function hasPost0002Schema(client: postgres.Sql): Promise<boolean> {
  return columnExists(client, "orders", "checkout_fulfilled_at");
}

async function hasPost0002Complete(client: postgres.Sql): Promise<boolean> {
  return (
    (await hasPost0002Schema(client)) &&
    (await indexExists(client, "admissions_order_id_unique"))
  );
}

function isCheckoutFulfillmentMigration(sql: string[]): boolean {
  return sql.some((statement) => statement.includes("checkout_fulfilled_at"));
}

async function main() {
  const migrations = readMigrationFiles({ migrationsFolder });
  const client = postgres(DATABASE_URL!, { max: 1 });

  try {
    const applied = await appliedHashes(client);
    const hasEvents = await tableExists(client, "events");

    if (!hasEvents) {
      console.error(
        "No events table found. Run `pnpm db:events-api:migrate` on a fresh database instead.",
      );
      process.exit(1);
    }

    if (!(await hasPost0001Schema(client))) {
      const [baseline, upgrade, ...rest] = migrations;
      if (!baseline || !upgrade) {
        console.error("Expected at least two migrations in drizzle/meta/_journal.json.");
        process.exit(1);
      }

      if (!applied.has(baseline.hash)) {
        console.log("Baselining migration 0000 (schema already present, journal entry missing).");
        await recordMigration(client, baseline.hash, baseline.folderMillis);
      }

      if (!applied.has(upgrade.hash)) {
        console.log("Applying migration 0001 (multi-mode tiers)…");
        await runMigrationStatements(client, upgrade.sql);
        await recordMigration(client, upgrade.hash, upgrade.folderMillis);
        console.log("Migration 0001 applied.");
      } else {
        console.log("Migration 0001 already recorded but selection_mode missing — re-applying SQL.");
        await runMigrationStatements(client, upgrade.sql);
      }

      if (!(await hasPost0001Schema(client))) {
        console.error("Repair finished but event_tiers.selection_mode is still missing.");
        process.exit(1);
      }

      for (const migration of rest) {
        if (isCheckoutFulfillmentMigration(migration.sql) && !(await hasPost0002Complete(client))) {
          console.log(`Applying migration ${migration.hash.slice(0, 12)}…`);
          await applyCheckoutFulfillmentMigration(client);
        }
        if (!applied.has(migration.hash) && (await hasPost0002Complete(client))) {
          await recordMigration(client, migration.hash, migration.folderMillis);
          console.log(`Recorded journal entry for ${migration.hash.slice(0, 12)}…`);
        }
      }

      if (rest.some((m) => isCheckoutFulfillmentMigration(m.sql)) && !(await hasPost0002Complete(client))) {
        console.error(
          "Repair finished but 0002 is incomplete (missing checkout_fulfilled_at and/or admissions_order_id_unique).",
        );
        process.exit(1);
      }

      console.log("Migration journal repaired.");
      return;
    }

    console.log("Schema includes event_tiers.selection_mode — syncing journal for 0000/0001.");
    const through0001 = migrations.filter((m) => !isCheckoutFulfillmentMigration(m.sql));
    for (const migration of through0001) {
      if (!applied.has(migration.hash)) {
        await recordMigration(client, migration.hash, migration.folderMillis);
        console.log(`Recorded journal entry for ${migration.hash.slice(0, 12)}…`);
      }
    }

    const pending0002 = migrations.filter((m) => isCheckoutFulfillmentMigration(m.sql));
    for (const migration of pending0002) {
      if (!(await hasPost0002Complete(client))) {
        console.log(`Applying migration ${migration.hash.slice(0, 12)}…`);
        await applyCheckoutFulfillmentMigration(client);
      } else {
        console.log(`Migration ${migration.hash.slice(0, 12)} already fully applied.`);
      }
      if (!applied.has(migration.hash) && (await hasPost0002Complete(client))) {
        await recordMigration(client, migration.hash, migration.folderMillis);
        console.log(`Recorded journal entry for ${migration.hash.slice(0, 12)}…`);
      }
    }

    if (!(await hasPost0002Complete(client))) {
      console.error(
        "Repair finished but 0002 is incomplete (missing checkout_fulfilled_at and/or admissions_order_id_unique).",
      );
      process.exit(1);
    }

    console.log(
      "Migration journal repaired. Run `pnpm db:events-api:migrate` to confirm (should be a no-op).",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
