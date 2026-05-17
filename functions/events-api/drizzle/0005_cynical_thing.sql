DROP INDEX "event_invitees_event_person_unique";--> statement-breakpoint
ALTER TABLE "event_invitees" ALTER COLUMN "person_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD COLUMN "given_name" text;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD COLUMN "family_name" text;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD COLUMN "phone" text;--> statement-breakpoint
CREATE UNIQUE INDEX "event_invitees_event_email_unique" ON "event_invitees" USING btree ("event_id","email") WHERE "event_invitees"."email" IS NOT NULL AND "event_invitees"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_invitees_event_phone_unique" ON "event_invitees" USING btree ("event_id","phone") WHERE "event_invitees"."phone" IS NOT NULL AND "event_invitees"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_invitees_event_person_unique" ON "event_invitees" USING btree ("event_id","person_id") WHERE "event_invitees"."person_id" IS NOT NULL;