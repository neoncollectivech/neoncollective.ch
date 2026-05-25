ALTER TABLE "orders" ADD COLUMN "checkout_fulfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "access_email_sent_at" timestamp with time zone;--> statement-breakpoint
UPDATE "orders" SET "checkout_fulfilled_at" = "updated_at" WHERE "status" = 'paid' AND "checkout_fulfilled_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "admissions_order_id_unique" ON "admissions" USING btree ("order_id");