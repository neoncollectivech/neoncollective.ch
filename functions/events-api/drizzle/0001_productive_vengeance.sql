CREATE TYPE "public"."tier_selection_mode" AS ENUM('exclusive', 'addon');--> statement-breakpoint
CREATE TABLE "order_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_tier_id" uuid NOT NULL,
	"unit_price_cents" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_tiers" ADD COLUMN "selection_mode" "tier_selection_mode" DEFAULT 'exclusive' NOT NULL;--> statement-breakpoint
INSERT INTO "order_tiers" ("order_id", "event_tier_id", "unit_price_cents")
SELECT "id", "event_tier_id", "unit_price_cents" FROM "orders";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_event_tier_id_event_tiers_id_fk";
--> statement-breakpoint
DROP INDEX "orders_event_tier_id_idx";--> statement-breakpoint
ALTER TABLE "order_tiers" ADD CONSTRAINT "order_tiers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tiers" ADD CONSTRAINT "order_tiers_event_tier_id_event_tiers_id_fk" FOREIGN KEY ("event_tier_id") REFERENCES "public"."event_tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_tiers_order_tier_unique" ON "order_tiers" USING btree ("order_id","event_tier_id");--> statement-breakpoint
CREATE INDEX "order_tiers_order_id_idx" ON "order_tiers" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_tiers_event_tier_id_idx" ON "order_tiers" USING btree ("event_tier_id");--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "event_tier_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "unit_price_cents";
