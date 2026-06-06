CREATE TYPE "public"."registration_status" AS ENUM('confirmed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."order_kind" AS ENUM('registration', 'upsell');--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'confirmed' NOT NULL,
	"exclusive_tier_id" uuid NOT NULL,
	"primary_order_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "registration_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_kind" "order_kind" DEFAULT 'registration' NOT NULL;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "registration_id" uuid;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_exclusive_tier_id_event_tiers_id_fk" FOREIGN KEY ("exclusive_tier_id") REFERENCES "public"."event_tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_primary_order_id_orders_id_fk" FOREIGN KEY ("primary_order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_person_unique" ON "event_registrations" USING btree ("event_id","person_id");--> statement-breakpoint
CREATE INDEX "event_registrations_event_id_idx" ON "event_registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_registrations_person_id_idx" ON "event_registrations" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "event_registrations_primary_order_id_idx" ON "event_registrations" USING btree ("primary_order_id");--> statement-breakpoint
CREATE INDEX "orders_registration_id_idx" ON "orders" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admissions_registration_id_unique" ON "admissions" USING btree ("registration_id") WHERE "registration_id" IS NOT NULL;
