/**
 * On-demand local / dev DB seed: wipes all events-api tables, then inserts published events
 * and a Filo invitee (person row created via invite materialize). No orders.
 *
 * Usage (from repo root or functions/events-api):
 *   pnpm --filter @neon/events-api db:seed:local
 *
 * Requires DATABASE_URL in functions/events-api/.env.local (same as migrations).
 * Runs `db:repair-migrations:local` first (via package.json) when the journal is out of sync with the schema.
 * Edit SEED_* constants below if you use a different identity.
 */

import { and, eq, sql } from "drizzle-orm";

import { phoneToStoredDigits } from "../helpers/contact";
import { closeDb, getDb } from "../db/index";
import { eventTiers, events, people } from "../db/schema";
import {
  regenerateInviteeHostLink,
  upsertInviteesForEvent,
} from "../routes/admin/providers/invitees-admin";

/** Override in `.env.local`: `SEED_EMAIL`, `SEED_PHONE_E164` (+41…). */
const SEED_EMAIL = process.env.SEED_EMAIL?.trim() || "filo87@gmail.com";
/** Swiss mobile; parsed to DB digits (4179…) via libphonenumber. */
const SEED_PHONE_E164 = process.env.SEED_PHONE_E164?.trim() || "+41796829564";
const SEED_GIVEN = "Filo";
const SEED_FAMILY = "Seed";

const SLUG_PUBLIC = "seed-public";
const SLUG_INVITE_ONLY = "seed-invite-only";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Use .env.local (see db:seed:local script).");
  }

  const phoneDigits = phoneToStoredDigits(SEED_PHONE_E164);
  if (!phoneDigits) {
    throw new Error(
      `SEED_PHONE_E164 is not a valid phone (${SEED_PHONE_E164}). Use E.164 or Swiss national (e.g. +41791234567 or 079 123 45 67).`,
    );
  }

  const db = getDb();
  await truncateAllApplicationData(db);
  // eslint-disable-next-line no-console -- CLI script
  console.log("Cleared all events-api tables.");

  const site = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
  let origin: string;
  try {
    origin = new URL(site).origin;
  } catch {
    origin = "http://localhost:3000";
  }

  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await ensurePublishedPublicEvent(db, startsAt);
  const inviteEventId = await ensurePublishedInviteOnlyEvent(db, startsAt);

  const upserted = await upsertInviteesForEvent(inviteEventId, [
    {
      givenName: SEED_GIVEN,
      familyName: SEED_FAMILY,
      email: SEED_EMAIL,
      phoneE164: SEED_PHONE_E164,
      maxRedemptions: 10,
      notes: "seed-local-test-data",
    },
  ]);
  const inviteeId = upserted.results[0]?.inviteeId;
  const personId = upserted.results[0]?.personId;
  if (!inviteeId || !personId) {
    throw new Error("Failed to upsert invitee / materialize person on invite-only event.");
  }

  const now = new Date();
  await db
    .update(people)
    .set({
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(people.id, personId));

  const linkResult = await regenerateInviteeHostLink(
    inviteEventId,
    inviteeId,
    10,
  );
  if (!linkResult.ok) {
    throw new Error(`Failed to mint host invite link: ${linkResult.reason}`);
  }
  const rawInviteToken = linkResult.inviteToken;

  // eslint-disable-next-line no-console -- CLI script
  console.log(`
Seed complete.

Person
  id:       ${personId}
  email:    ${SEED_EMAIL}
  phone:    ${SEED_PHONE_E164} (stored as digits: ${phoneDigits})

Sign-in: use this exact phone or ${SEED_EMAIL}. Email and phone are pre-verified (no profile OTP in dev).

Published public event (catalog + open checkout)
  slug:     ${SLUG_PUBLIC}
  url:      ${origin}/en/events/${SLUG_PUBLIC}

Published invite-only event (event invite; open with invite token or sign in on the private dossier URL)
  slug:     ${SLUG_INVITE_ONLY}
  url:      ${origin}/en/events?invite=${encodeURIComponent(rawInviteToken)}

Invite token (raw, for ?invite=): ${rawInviteToken}

No orders were created. Registration sign-in works via paid order OR active invitee on a published event (you have the latter).
`);
}

type Db = ReturnType<typeof getDb>;

/** Dev-only full reset — leaves `drizzle.__drizzle_migrations` intact. */
async function truncateAllApplicationData(db: Db): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      "profile_verification_codes",
      "registration_exchange_codes",
      "participant_sessions",
      "invite_redemptions",
      "admissions",
      "orders",
      "invite_links",
      "event_invitees",
      "event_tiers",
      "events",
      "stripe_events_processed",
      "people"
    CASCADE
  `);
}

async function ensurePublishedPublicEvent(db: Db, startsAt: Date): Promise<string> {
  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, SLUG_PUBLIC))
    .limit(1);
  if (existing) {
    await ensureTier(
      db,
      existing.id,
      "Standard",
      2500,
      "Entry and access for the full night — bar not included.",
    );
    await ensureAddonTier(
      db,
      existing.id,
      "Bar package",
      800,
      "One drink token at the bar.",
      50,
    );
    return existing.id;
  }
  const [ev] = await db
    .insert(events)
    .values({
      slug: SLUG_PUBLIC,
      title: "[Seed] Public night",
      summary: "Local seed — public access, visible in catalog.",
      location: "Zürich",
      startsAt,
      status: "published",
      accessMode: "public",
      eventQuota: 200,
      defaultInviteLinkMaxRedemptions: 0,
    })
    .returning({ id: events.id });
  const id = ev!.id;
  await ensureTier(
    db,
    id,
    "Standard",
    2500,
    "Entry and access for the full night — bar not included.",
  );
  await ensureAddonTier(
    db,
    id,
    "Bar package",
    800,
    "One drink token at the bar.",
    50,
  );
  return id;
}

async function ensurePublishedInviteOnlyEvent(db: Db, startsAt: Date): Promise<string> {
  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, SLUG_INVITE_ONLY))
    .limit(1);
  if (existing) {
    await ensureTier(
      db,
      existing.id,
      "Guest",
      1500,
      "Guest-list admission — one drink token at the bar.",
    );
    return existing.id;
  }
  const [ev] = await db
    .insert(events)
    .values({
      slug: SLUG_INVITE_ONLY,
      title: "[Seed] Invite-only salon",
      summary: "Local seed — invite link or invited email/phone only.",
      location: "Private",
      startsAt,
      status: "published",
      accessMode: "invite_only",
      eventQuota: 80,
      defaultInviteLinkMaxRedemptions: 5,
    })
    .returning({ id: events.id });
  const id = ev!.id;
  await ensureTier(
    db,
    id,
    "Guest",
    1500,
    "Guest-list admission — one drink token at the bar.",
  );
  return id;
}

async function ensureTier(
  db: Db,
  eventId: string,
  name: string,
  priceCents: number,
  description: string,
): Promise<void> {
  const rows = await db.select({ id: eventTiers.id }).from(eventTiers).where(eq(eventTiers.eventId, eventId));
  if (rows.length > 0) {
    return;
  }
  await db.insert(eventTiers).values({
    eventId,
    name,
    description,
    priceCents,
    currency: "chf",
    quota: null,
    sortOrder: 0,
    active: true,
    selectionMode: "exclusive",
  });
}

async function ensureAddonTier(
  db: Db,
  eventId: string,
  name: string,
  priceCents: number,
  description: string,
  quota: number,
): Promise<void> {
  const [existing] = await db
    .select({ id: eventTiers.id })
    .from(eventTiers)
    .where(
      and(
        eq(eventTiers.eventId, eventId),
        eq(eventTiers.name, name),
        eq(eventTiers.selectionMode, "addon"),
      ),
    )
    .limit(1);
  if (existing) {
    return;
  }
  await db.insert(eventTiers).values({
    eventId,
    name,
    description,
    priceCents,
    currency: "chf",
    quota,
    sortOrder: 1,
    active: true,
    selectionMode: "addon",
  });
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console -- CLI script
    console.error(e);
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
