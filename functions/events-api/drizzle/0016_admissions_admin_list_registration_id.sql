DROP VIEW IF EXISTS "admissions_admin_list";
--> statement-breakpoint
CREATE VIEW "admissions_admin_list" AS
SELECT
  a."id",
  a."registration_id",
  a."event_id",
  a."signed_credential",
  a."checked_in_at",
  a."checked_in_by",
  a."revoked_at",
  a."created_at",
  er."person_id",
  p."given_name",
  p."family_name"
FROM "admissions" a
INNER JOIN "event_registrations" er ON er."id" = a."registration_id"
INNER JOIN "people" p ON p."id" = er."person_id";
