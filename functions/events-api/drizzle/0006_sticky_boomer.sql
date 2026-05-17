ALTER TABLE "invite_links" DROP CONSTRAINT "invite_links_event_invitee_id_event_invitees_id_fk";
--> statement-breakpoint
DROP INDEX "invite_links_invitee_unique";
--> statement-breakpoint
ALTER TABLE "event_invitees" ADD COLUMN "inviter_id" uuid;
--> statement-breakpoint
ALTER TABLE "invite_links" ADD COLUMN "inviter_id" uuid;
--> statement-breakpoint
ALTER TABLE "invite_links" ADD COLUMN "max_redemptions" integer;
--> statement-breakpoint
UPDATE "invite_links" AS il
SET
  "max_redemptions" = COALESCE(ei."invite_link_max_redemptions_override", e."default_invite_link_max_redemptions", 0),
  "inviter_id" = ei."person_id"
FROM "event_invitees" AS ei,
  "events" AS e
WHERE il."event_invitee_id" = ei."id"
  AND il."event_id" = e."id";
--> statement-breakpoint
UPDATE "invite_links" SET "max_redemptions" = 0 WHERE "max_redemptions" IS NULL;
--> statement-breakpoint
ALTER TABLE "invite_links" ALTER COLUMN "max_redemptions" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_inviter_id_people_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_inviter_id_people_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_invitees_inviter_id_idx" ON "event_invitees" USING btree ("inviter_id");
--> statement-breakpoint
CREATE INDEX "invite_links_inviter_id_idx" ON "invite_links" USING btree ("inviter_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "invite_links_event_host_unique" ON "invite_links" USING btree ("event_id","inviter_id") WHERE "invite_links"."inviter_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_invitees" DROP COLUMN "given_name";
--> statement-breakpoint
ALTER TABLE "event_invitees" DROP COLUMN "family_name";
--> statement-breakpoint
ALTER TABLE "event_invitees" DROP COLUMN "invite_link_max_redemptions_override";
--> statement-breakpoint
ALTER TABLE "invite_links" DROP COLUMN "event_invitee_id";
--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_identity_ck" CHECK ("event_invitees"."person_id" IS NOT NULL OR "event_invitees"."email" IS NOT NULL OR "event_invitees"."phone" IS NOT NULL);
