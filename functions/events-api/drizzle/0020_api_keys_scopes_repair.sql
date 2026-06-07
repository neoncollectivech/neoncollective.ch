-- Repair: 0019 may be recorded in __drizzle_migrations without this column present
-- (e.g. after db:push or branch reset). Safe to re-run.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "scopes" text[] DEFAULT ARRAY['check_in','pos']::text[];--> statement-breakpoint
UPDATE "api_keys" SET "scopes" = ARRAY['check_in','pos']::text[] WHERE "scopes" IS NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "scopes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "scopes" SET DEFAULT ARRAY['check_in','pos']::text[];--> statement-breakpoint
UPDATE "api_keys" SET "scopes" = ARRAY['check_in','pos','pos_admin','admissions_list']::text[] WHERE "event_id" IS NULL;
