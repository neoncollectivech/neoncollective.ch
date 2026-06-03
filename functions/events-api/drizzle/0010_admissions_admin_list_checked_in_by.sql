DROP VIEW IF EXISTS "admissions_admin_list";
--> statement-breakpoint
CREATE VIEW "admissions_admin_list" AS
SELECT
  a."id",
  a."order_id",
  a."event_id",
  a."signed_credential",
  a."checked_in_at",
  a."checked_in_by",
  a."revoked_at",
  a."created_at",
  o."person_id",
  p."given_name",
  p."family_name"
FROM "admissions" a
INNER JOIN "orders" o ON o."id" = a."order_id"
INNER JOIN "people" p ON p."id" = o."person_id";
