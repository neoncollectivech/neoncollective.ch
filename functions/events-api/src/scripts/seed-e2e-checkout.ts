/**
 * E2E Playwright seed: invite-only event + three distinct participant personas.
 *
 * Usage:
 *   pnpm --filter @neon/events-api db:seed:e2e
 *
 * Personas:
 *   - Host Invited — on guest list; paid invite-only checkout + host invite link
 *   - Guest Invited — joins via host link (not on guest list in seed)
 *   - Host InvitedPromo — on guest list; promotion / free checkout flow
 *
 * Prints one JSON line to stdout for test/global-setup.mjs.
 */

import { and, eq, sql } from "drizzle-orm";

import { phoneToStoredDigits } from "../helpers/contact";
import { closeDb, getDb } from "../db/index";
import { eventTiers, events, people, promotionCodes } from "../db/schema";
import { upsertInviteesForEvent } from "../routes/admin/providers/invitees-admin";

const SLUG = "e2e-invite-only";
const LOCALE = "en";

const ROOT_TIER_NAME = "Root";
const ROOT_TIER_CENTS = 1500;
const ADDON_1_TIER_NAME = "Addon 1";
const ADDON_1_TIER_CENTS = 800;
const ADDON_2_TIER_NAME = "Addon 2";
const ADDON_2_TIER_CENTS = 500;
const PROMO_CODE = "E2ETIER";

const HOST_INVITED = {
  phone: process.env.E2E_HOST_INVITED_PHONE?.trim() || "+41791234567",
  email: process.env.E2E_HOST_INVITED_EMAIL?.trim() || "e2e-host-invited@neon.test",
  givenName: "E2E",
  familyName: "HostInvited",
};

const GUEST_INVITED = {
  phone: process.env.E2E_GUEST_INVITED_PHONE?.trim() || "+41791234568",
  givenName: "E2E",
  familyName: "GuestInvited",
};

const HOST_INVITED_PROMO = {
  phone: process.env.E2E_HOST_INVITED_PROMO_PHONE?.trim() || "+41791234569",
  email:
    process.env.E2E_HOST_INVITED_PROMO_EMAIL?.trim() ||
    "e2e-host-invited-promo@neon.test",
  givenName: "E2E",
  familyName: "HostInvitedPromo",
};

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
      "promotion_code_redemptions",
      "promotion_codes",
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

type E2eTierIds = {
  rootId: string;
  addon1Id: string;
  addon2Id: string;
};

async function tierIdByName(
  db: Db,
  eventId: string,
  name: string,
  selectionMode: "exclusive" | "addon",
): Promise<string> {
  const [row] = await db
    .select({ id: eventTiers.id })
    .from(eventTiers)
    .where(
      and(
        eq(eventTiers.eventId, eventId),
        eq(eventTiers.name, name),
        eq(eventTiers.selectionMode, selectionMode),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error(`E2E tier not found: ${name} (${selectionMode})`);
  }
  return row.id;
}

async function ensureTierPricesPromo(
  db: Db,
  eventId: string,
  tierIds: E2eTierIds,
): Promise<void> {
  const [existing] = await db
    .select({ id: promotionCodes.id })
    .from(promotionCodes)
    .where(and(eq(promotionCodes.eventId, eventId), eq(promotionCodes.code, PROMO_CODE)))
    .limit(1);
  if (existing) {
    return;
  }
  await db.insert(promotionCodes).values({
    eventId,
    code: PROMO_CODE,
    kind: "tier_prices",
    percentBps: null,
    amountOffCents: null,
    tierOverrides: [
      { eventTierId: tierIds.rootId, priceCents: 0 },
      { eventTierId: tierIds.addon1Id, priceCents: 0 },
    ],
    maxRedemptions: null,
    active: true,
  });
}

async function ensureE2eEventTiers(db: Db, eventId: string): Promise<E2eTierIds> {
  await ensureTier(db, eventId, {
    name: ROOT_TIER_NAME,
    description: "E2E mandatory root tier.",
    priceCents: ROOT_TIER_CENTS,
    selectionMode: "exclusive",
    sortOrder: 0,
    quota: null,
  });
  await ensureTier(db, eventId, {
    name: ADDON_1_TIER_NAME,
    description: "E2E first add-on.",
    priceCents: ADDON_1_TIER_CENTS,
    selectionMode: "addon",
    sortOrder: 1,
    quota: 50,
  });
  await ensureTier(db, eventId, {
    name: ADDON_2_TIER_NAME,
    description: "E2E second add-on.",
    priceCents: ADDON_2_TIER_CENTS,
    selectionMode: "addon",
    sortOrder: 2,
    quota: 50,
  });
  return {
    rootId: await tierIdByName(db, eventId, ROOT_TIER_NAME, "exclusive"),
    addon1Id: await tierIdByName(db, eventId, ADDON_1_TIER_NAME, "addon"),
    addon2Id: await tierIdByName(db, eventId, ADDON_2_TIER_NAME, "addon"),
  };
}

async function ensureInviteOnlyEvent(
  db: Db,
  startsAt: Date,
): Promise<{ eventId: string; tierIds: E2eTierIds }> {
  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, SLUG))
    .limit(1);
  if (existing) {
    const tierIds = await ensureE2eEventTiers(db, existing.id);
    await ensureTierPricesPromo(db, existing.id, tierIds);
    return { eventId: existing.id, tierIds };
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
  const tierIds = await ensureE2eEventTiers(db, id);
  await ensureTierPricesPromo(db, id, tierIds);
  return { eventId: id, tierIds };
}

function assertPhoneE164(label: string, phone: string): void {
  if (!phoneToStoredDigits(phone)) {
    throw new Error(`${label} phone is invalid: ${phone}`);
  }
}

async function verifyPersonContact(db: Db, personId: string): Promise<void> {
  const now = new Date();
  await db
    .update(people)
    .set({
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(people.id, personId));
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Use .env.local (see db:seed:e2e).");
  }

  assertPhoneE164("Host Invited", HOST_INVITED.phone);
  assertPhoneE164("Guest Invited", GUEST_INVITED.phone);
  assertPhoneE164("Host InvitedPromo", HOST_INVITED_PROMO.phone);

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
  const { eventId } = await ensureInviteOnlyEvent(db, startsAt);

  const upserted = await upsertInviteesForEvent(eventId, [
    {
      givenName: HOST_INVITED.givenName,
      familyName: HOST_INVITED.familyName,
      email: HOST_INVITED.email,
      phoneE164: HOST_INVITED.phone,
      maxRedemptions: 10,
      notes: "seed-e2e-host-invited",
    },
    {
      givenName: HOST_INVITED_PROMO.givenName,
      familyName: HOST_INVITED_PROMO.familyName,
      email: HOST_INVITED_PROMO.email,
      phoneE164: HOST_INVITED_PROMO.phone,
      maxRedemptions: 10,
      notes: "seed-e2e-host-invited-promo",
    },
  ]);

  const hostInvitedPersonId = upserted.results[0]?.personId;
  const hostInvitedPromoPersonId = upserted.results[1]?.personId;
  if (!hostInvitedPersonId || !hostInvitedPromoPersonId) {
    throw new Error("Failed to upsert Host Invited / Host InvitedPromo on guest list.");
  }

  await verifyPersonContact(db, hostInvitedPersonId);
  await verifyPersonContact(db, hostInvitedPromoPersonId);

  const privateUrl = `${origin}/${LOCALE}/events/private?slug=${encodeURIComponent(SLUG)}`;
  const freePromoUrl = `${privateUrl}&promo=${encodeURIComponent(PROMO_CODE)}`;
  const checkoutTotalCents = ROOT_TIER_CENTS + ADDON_1_TIER_CENTS;
  const promoAllTiersTotalCents = ADDON_2_TIER_CENTS;

  const payload = {
    slug: SLUG,
    locale: LOCALE,
    hostInvited: HOST_INVITED,
    guestInvited: GUEST_INVITED,
    hostInvitedPromo: HOST_INVITED_PROMO,
    privateUrl,
    freePromoUrl,
    promoCode: PROMO_CODE,
    rootTierName: ROOT_TIER_NAME,
    addon1TierName: ADDON_1_TIER_NAME,
    addon2TierName: ADDON_2_TIER_NAME,
    exclusiveTierName: ROOT_TIER_NAME,
    addonTierName: ADDON_1_TIER_NAME,
    guestTierLine: `${ROOT_TIER_NAME} + ${ADDON_1_TIER_NAME}`,
    checkoutTotalChf: checkoutTotalCents / 100,
    checkoutTotalCents,
    promoAllTiersTotalChf: promoAllTiersTotalCents / 100,
    promoAllTiersTotalCents,
    freeCheckoutTotalChf: 0,
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
