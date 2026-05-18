import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const eventStatusEnum = pgEnum("event_status", ["draft", "published"]);
export const accessModeEnum = pgEnum("access_mode", ["public", "invite_only"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);
export const tierSelectionModeEnum = pgEnum("tier_selection_mode", [
  "exclusive",
  "addon",
]);

/** Global identity: contact info normalized (email lowercased; phone digits only, no +). */
export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    givenName: text("given_name").notNull(),
    familyName: text("family_name").notNull(),
    email: text("email"),
    /** E.164 digits only, e.g. 41791234567 */
    phone: text("phone"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("people_email_unique").on(t.email).where(sql`${t.email} IS NOT NULL`),
    uniqueIndex("people_phone_unique").on(t.phone).where(sql`${t.phone} IS NOT NULL`),
    check(
      "people_contact_ck",
      sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`,
    ),
  ],
);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** Short plain-text description for listings and the event page. */
  summary: text("summary"),
  /** Venue / city line (plain text). */
  location: text("location"),
  /** Absolute image URLs (hero first). Stored as JSON array. */
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  status: eventStatusEnum("status").notNull().default("draft"),
  eventQuota: integer("event_quota"),
  accessMode: accessModeEnum("access_mode").notNull().default("public"),
  defaultInviteLinkMaxRedemptions: integer("default_invite_link_max_redemptions")
    .notNull()
    .default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventTiers = pgTable(
  "event_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Plain text: what this contribution tier includes. */
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("chf"),
    /** Null = unlimited at tier level; event `event_quota` still caps total headcount. */
    quota: integer("quota"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    /** `exclusive` = pick one (radio); `addon` = combinable (checkbox). */
    selectionMode: tierSelectionModeEnum("selection_mode")
      .notNull()
      .default("exclusive"),
  },
  (t) => [index("event_tiers_event_id_idx").on(t.eventId)],
);

export const eventInvitees = pgTable(
  "event_invitees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Set when guest profile is complete or admin provided full identity at invite time. */
    personId: uuid("person_id").references(() => people.id, { onDelete: "restrict" }),
    /** Null = admin / first-degree invite; otherwise the inviting person. */
    inviterId: uuid("inviter_id").references(() => people.id, { onDelete: "restrict" }),
    /** Pending event-invite contact until person_id is linked (normalized like people). */
    email: text("email"),
    /** E.164 digits only, e.g. 41791234567 */
    phone: text("phone"),
    notes: text("notes"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("event_invitees_event_id_idx").on(t.eventId),
    index("event_invitees_inviter_id_idx").on(t.inviterId),
    uniqueIndex("event_invitees_event_person_unique")
      .on(t.eventId, t.personId)
      .where(sql`${t.personId} IS NOT NULL`),
    uniqueIndex("event_invitees_event_email_unique")
      .on(t.eventId, t.email)
      .where(sql`${t.email} IS NOT NULL AND ${t.revokedAt} IS NULL`),
    uniqueIndex("event_invitees_event_phone_unique")
      .on(t.eventId, t.phone)
      .where(sql`${t.phone} IS NOT NULL AND ${t.revokedAt} IS NULL`),
    check(
      "event_invitees_identity_ck",
      sql`${t.personId} IS NOT NULL OR ${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`,
    ),
  ],
);

export const inviteLinks = pgTable(
  "invite_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Null = admin-issued link; otherwise the host person who may share guests. */
    inviterId: uuid("inviter_id").references(() => people.id, { onDelete: "restrict" }),
    maxRedemptions: integer("max_redemptions").notNull(),
    /** Raw secret in invite URLs (hash used for lookup). */
    token: text("token").notNull().unique(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (t) => [
    index("invite_links_event_id_idx").on(t.eventId),
    index("invite_links_inviter_id_idx").on(t.inviterId),
    uniqueIndex("invite_links_event_host_unique")
      .on(t.eventId, t.inviterId)
      .where(sql`${t.inviterId} IS NOT NULL`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    locale: text("locale").notNull().default("en"),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    status: orderStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    inviteLinkId: uuid("invite_link_id").references(() => inviteLinks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_event_id_idx").on(t.eventId),
    index("orders_invite_link_id_idx").on(t.inviteLinkId),
    index("orders_person_id_idx").on(t.personId),
  ],
);

export const orderTiers = pgTable(
  "order_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventTierId: uuid("event_tier_id")
      .notNull()
      .references(() => eventTiers.id, { onDelete: "restrict" }),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [
    uniqueIndex("order_tiers_order_tier_unique").on(t.orderId, t.eventTierId),
    index("order_tiers_order_id_idx").on(t.orderId),
    index("order_tiers_event_tier_id_idx").on(t.eventTierId),
  ],
);

export const admissions = pgTable(
  "admissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicToken: text("public_token").notNull().unique(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    eventTierId: uuid("event_tier_id")
      .notNull()
      .references(() => eventTiers.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: text("checked_in_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admissions_event_id_idx").on(t.eventId), index("admissions_order_id_idx").on(t.orderId)],
);

export const inviteRedemptions = pgTable(
  "invite_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inviteLinkId: uuid("invite_link_id")
      .notNull()
      .references(() => inviteLinks.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invite_redemptions_order_unique").on(t.orderId),
    index("invite_redemptions_link_idx").on(t.inviteLinkId),
  ],
);

export const stripeEventsProcessed = pgTable("stripe_events_processed", {
  stripeEventId: text("stripe_event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const participantSessions = pgTable(
  "participant_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }),
    inviteLinkId: uuid("invite_link_id").references(() => inviteLinks.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("participant_sessions_person_id_idx").on(t.personId),
    index("participant_sessions_invite_link_id_idx").on(t.inviteLinkId),
  ],
);

export const profileVerificationChannelEnum = pgEnum("profile_verification_channel", [
  "email",
  "phone",
]);

export const profileVerificationCodes = pgTable(
  "profile_verification_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull(),
    codeHash: text("code_hash").notNull().unique(),
    channel: profileVerificationChannelEnum("channel").notNull(),
    /** Hash of normalized email or phone digits — must match on confirm. */
    contactHash: text("contact_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "profile_verification_codes_session_fk",
      columns: [t.sessionId],
      foreignColumns: [participantSessions.id],
    }).onDelete("cascade"),
    index("profile_verification_codes_session_id_idx").on(t.sessionId),
  ],
);

export const registrationExchangeCodes = pgTable(
  "registration_exchange_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeHash: text("code_hash").notNull().unique(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** Channel used to deliver the sign-in code (marks that contact verified on exchange). */
    channel: profileVerificationChannelEnum("channel").notNull().default("email"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [],
);
