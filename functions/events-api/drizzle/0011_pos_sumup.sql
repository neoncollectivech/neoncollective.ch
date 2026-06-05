CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'sumup');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_provider" "payment_provider" DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sumup_client_transaction_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sumup_reader_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pos_sold_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_sumup_client_transaction_id_unique" ON "orders" USING btree ("sumup_client_transaction_id");--> statement-breakpoint
CREATE TABLE "sumup_events_processed" (
	"sumup_event_id" text PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
