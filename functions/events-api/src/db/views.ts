import { pgView, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Admin list read model: admission + order person name (see migration 0009). */
export const admissionsAdminListView = pgView("admissions_admin_list", {
  id: uuid("id").primaryKey(),
  orderId: uuid("order_id").notNull(),
  eventId: uuid("event_id").notNull(),
  signedCredential: text("signed_credential").notNull(),
  personId: uuid("person_id").notNull(),
  givenName: text("given_name").notNull(),
  familyName: text("family_name").notNull(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}).existing();
