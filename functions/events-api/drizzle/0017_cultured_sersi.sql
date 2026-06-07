ALTER TABLE "events" ALTER COLUMN "summary" SET DATA TYPE jsonb USING
  CASE
    WHEN "summary" IS NULL OR btrim("summary") = '' THEN '{}'::jsonb
    ELSE jsonb_build_object('en', "summary")
  END;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "summary" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "summary" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_tiers" ALTER COLUMN "description" SET DATA TYPE jsonb USING
  CASE
    WHEN btrim("description") = '' THEN '{}'::jsonb
    ELSE jsonb_build_object('en', "description")
  END;--> statement-breakpoint
ALTER TABLE "event_tiers" ALTER COLUMN "description" SET DEFAULT '{}'::jsonb;
