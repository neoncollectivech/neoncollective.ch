TRUNCATE TABLE "admissions";
--> statement-breakpoint
CREATE TABLE "admission_signing_keys" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"kid" text NOT NULL,
	"algorithm" text DEFAULT 'EdDSA' NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"private_jwk" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_signing_keys_kid_unique" UNIQUE("kid")
);
--> statement-breakpoint
ALTER TABLE "admission_signing_keys" ADD CONSTRAINT "admission_signing_keys_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admissions" DROP CONSTRAINT "admissions_event_tier_id_event_tiers_id_fk";
--> statement-breakpoint
ALTER TABLE "admissions" DROP CONSTRAINT "admissions_public_token_unique";
--> statement-breakpoint
ALTER TABLE "admissions" DROP COLUMN "public_token";
--> statement-breakpoint
ALTER TABLE "admissions" DROP COLUMN "event_tier_id";
--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "signed_credential" text NOT NULL;
