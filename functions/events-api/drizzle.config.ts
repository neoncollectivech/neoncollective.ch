import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit: schema → SQL migrations in `./drizzle`, tracked in `./drizzle/meta/_journal.json`.
 *
 * - `pnpm db:generate` — create a new migration from schema changes (commit the generated SQL + meta).
 * - `pnpm db:migrate` — apply pending migrations (requires `DATABASE_URL` in the environment).
 * - `pnpm db:migrate:local` — same, loading `functions/events-api/.env.local` via dotenv-cli.
 * - `pnpm db:push:local` — push schema directly to the DB (dev only; bypasses migration files).
 */
export default defineConfig({
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
