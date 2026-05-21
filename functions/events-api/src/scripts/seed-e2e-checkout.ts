/**
 * E2E Playwright seed: invite-only event + Person A on guest list (no orders, no host link).
 *
 * Usage:
 *   pnpm --filter @neon/events-api db:seed:e2e
 *
 * Prints one JSON line to stdout for test/global-setup.ts:
 *   { slug, personAPhone, personBPhone, privateUrl, locale, exclusiveTierName, addonTierName, checkoutTotalChf }
 */

import { and, eq, sql } from "drizzle-orm";

import { phoneToStoredDigits } from "../helpers/contact";
import { closeDb, getDb } from "../db/index";
import { eventTiers, events, people } from "../db/schema";
import { upsertInviteesForEvent } from "../routes/admin/providers/invitees-admin";

const SLUG = "e2e-invite-only";
const LOCALE = "en";

const EXCLUSIVE_TIER_NAME = "Guest";
const EXCLUSIVE_TIER_CENTS = 1500;
const ADDON_TIER_NAME = "Bar package";
const ADDON_TIER_CENTS = 800;

const PERSON_A_PHONE = process.env.E2E_PERSON_A_PHONE?.trim() || "+41791234567";
const PERSON_B_PHONE = process.env.E2E_PERSON_B_PHONE?.trim() || "+41791234568";
const PERSON_A_EMAIL = process.env.E2E_PERSON_A_EMAIL?.trim() || "e2e-host-a@neon.test";
const PERSON_A_GIVEN = "E2E";
const PERSON_A_FAMILY = "Host";

type Db = ReturnType<typeof getDb>;

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

async function ensureTier(
  db: Db,
  eventId: string,
  params: {
    name: string;
    description: string;
    priceCents: number;
    selectionMode: "exclusive" | "addon";
    sortOrder: number;
    quota: number | null;
  },
): Promise<void> {
  const [existing] = await db
    .select({ id: eventTiers.id })
    .from(eventTiers)
    .where(
      and(
        eq(eventTiers.eventId, eventId),
        eq(eventTiers.name, params.name),
        eq(eventTiers.selectionMode, params.selectionMode),
      ),
    )
    .limit(1);
  if (existing) {
    return;
  }
  await db.insert(eventTiers).values({
    eventId,
    name: params.name,
    description: params.description,
    priceCents: params.priceCents,
    currency: "chf",
    quota: params.quota,
    sortOrder: params.sortOrder,
    active: true,
    selectionMode: params.selectionMode,
  });
}

async function ensureE2eEventTiers(db: Db, eventId: string): Promise<void> {
  await ensureTier(db, eventId, {
    name: EXCLUSIVE_TIER_NAME,
    description: "E2E guest-list tier.",
    priceCents: EXCLUSIVE_TIER_CENTS,
    selectionMode: "exclusive",
    sortOrder: 0,
    quota: null,
  });
  await ensureTier(db, eventId, {
    name: ADDON_TIER_NAME,
    description: "E2E optional bar add-on.",
    priceCents: ADDON_TIER_CENTS,
    selectionMode: "addon",
    sortOrder: 1,
    quota: 50,
  });
}

async function ensureInviteOnlyEvent(db: Db, startsAt: Date): Promise<string> {
  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, SLUG))
    .limit(1);
  if (existing) {
    await ensureE2eEventTiers(db, existing.id);
    return existing.id;
  }
  const [ev] = await db
    .insert(events)
    .values({
      slug: SLUG,
      title: "[E2E] Invite-only checkout",
      summary: "Playwright checkout flow seed.",
      location: "Test",
      imageUrls: [],
      startsAt,
      status: "published",
      accessMode: "invite_only",
      eventQuota: 80,
      defaultInviteLinkMaxRedemptions: 5,
    })
    .returning({ id: events.id });
  const id = ev!.id;
  await ensureE2eEventTiers(db, id);
  return id;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Use .env.local (see db:seed:e2e).");
  }

  const phoneDigits = phoneToStoredDigits(PERSON_A_PHONE);
  if (!phoneDigits) {
    throw new Error(`E2E_PERSON_A_PHONE is invalid: ${PERSON_A_PHONE}`);
  }

  const site = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
  let origin: string;
  try {
    origin = new URL(site).origin;
  } catch {
    origin = "http://localhost:3000";
  }

  const db = getDb();
  await truncateAllApplicationData(db);

  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const eventId = await ensureInviteOnlyEvent(db, startsAt);

  const upserted = await upsertInviteesForEvent(eventId, [
    {
      givenName: PERSON_A_GIVEN,
      familyName: PERSON_A_FAMILY,
      email: PERSON_A_EMAIL,
      phoneE164: PERSON_A_PHONE,
      maxRedemptions: 10,
      notes: "seed-e2e-checkout",
    },
  ]);
  const personId = upserted.results[0]?.personId;
  if (!personId) {
    throw new Error("Failed to upsert Person A invitee.");
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

  const privateUrl = `${origin}/${LOCALE}/events/private?slug=${encodeURIComponent(SLUG)}`;
  const checkoutTotalCents = EXCLUSIVE_TIER_CENTS + ADDON_TIER_CENTS;

  const payload = {
    slug: SLUG,
    locale: LOCALE,
    personAPhone: PERSON_A_PHONE,
    personBPhone: PERSON_B_PHONE,
    personBGivenName: "E2E",
    personBFamilyName: "Invited",
    privateUrl,
    exclusiveTierName: EXCLUSIVE_TIER_NAME,
    addonTierName: ADDON_TIER_NAME,
    guestTierLine: `${EXCLUSIVE_TIER_NAME} + ${ADDON_TIER_NAME}`,
    checkoutTotalChf: checkoutTotalCents / 100,
    checkoutTotalCents,
  };

  // eslint-disable-next-line no-console -- machine-readable for Playwright globalSetup
  console.log(JSON.stringify(payload));
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
