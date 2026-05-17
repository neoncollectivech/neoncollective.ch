/**
 * Repairs `drizzle.__drizzle_migrations` when the DB already has the 0000 schema
 * (e.g. from an earlier push) but migrate fails replaying 0000, leaving 0001 unapplied.
 *
 * Usage: pnpm --filter @neon/events-api db:repair-migrations:local
 */

import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../../drizzle");

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required (use db:repair-migrations:local).");
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

async function main() {
  const migrations = readMigrationFiles({ migrationsFolder });
  const client = postgres(DATABASE_URL!, { max: 1 });

  try {
    const applied = await appliedHashes(client);
    const hasEvents = await tableExists(client, "events");
    const hasSelectionMode = await columnExists(client, "event_tiers", "selection_mode");

    if (hasSelectionMode) {
      console.log("Schema already includes event_tiers.selection_mode — syncing journal only.");
      for (const migration of migrations) {
        if (!applied.has(migration.hash)) {
          await recordMigration(client, migration.hash, migration.folderMillis);
          console.log(`Recorded journal entry for migration ${migration.hash.slice(0, 12)}…`);
        }
      }
      return;
    }

    if (!hasEvents) {
      console.error(
        "No events table found. Run `pnpm db:events-api:migrate:local` on a fresh database instead.",
      );
      process.exit(1);
    }

    const [baseline, upgrade] = migrations;
    if (!baseline || !upgrade) {
      console.error("Expected two migrations in drizzle/meta/_journal.json.");
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

    const ok = await columnExists(client, "event_tiers", "selection_mode");
    if (!ok) {
      console.error("Repair finished but event_tiers.selection_mode is still missing.");
      process.exit(1);
    }

    console.log("Migration journal repaired. You can run `pnpm db:events-api:seed:local` now.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
