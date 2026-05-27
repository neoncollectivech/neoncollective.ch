CREATE TYPE "public"."promotion_kind" AS ENUM('percent_off', 'amount_off', 'tier_prices');--> statement-breakpoint
CREATE TABLE "promotion_code_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_code_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" "promotion_kind" NOT NULL,
	"percent_bps" integer,
	"amount_off_cents" integer,
	"tier_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_redemptions" integer,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_codes_percent_bps_nonneg_ck" CHECK ("promotion_codes"."percent_bps" IS NULL OR "promotion_codes"."percent_bps" >= 0),
	CONSTRAINT "promotion_codes_amount_off_nonneg_ck" CHECK ("promotion_codes"."amount_off_cents" IS NULL OR "promotion_codes"."amount_off_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promotion_code_id" uuid;--> statement-breakpoint
ALTER TABLE "promotion_code_redemptions" ADD CONSTRAINT "promotion_code_redemptions_promotion_code_id_promotion_codes_id_fk" FOREIGN KEY ("promotion_code_id") REFERENCES "public"."promotion_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_code_redemptions" ADD CONSTRAINT "promotion_code_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_codes" ADD CONSTRAINT "promotion_codes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_code_redemptions_order_unique" ON "promotion_code_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "promotion_code_redemptions_code_idx" ON "promotion_code_redemptions" USING btree ("promotion_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_codes_event_code_unique" ON "promotion_codes" USING btree ("event_id","code");--> statement-breakpoint
CREATE INDEX "promotion_codes_event_id_idx" ON "promotion_codes" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_code_id_promotion_codes_id_fk" FOREIGN KEY ("promotion_code_id") REFERENCES "public"."promotion_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_promotion_code_id_idx" ON "orders" USING btree ("promotion_code_id");