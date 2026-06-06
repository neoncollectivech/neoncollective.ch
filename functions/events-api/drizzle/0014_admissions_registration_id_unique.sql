DROP INDEX IF EXISTS "admissions_registration_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "admissions_registration_id_unique" ON "admissions" USING btree ("registration_id");
