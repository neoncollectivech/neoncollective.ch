import type Stripe from "stripe";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db/index.js";
import {
  events,
  eventTiers,
  inviteLinks,
  orders,
  orderTiers,
  people,
} from "../db/schema.js";
import { sha256Hex } from "../token.js";
import { normalizeOptionalPhoneE164, phoneToStoredDigits } from "../contact.js";
import { stripe } from "../stripe.js";
import {
  computeTierPlacesRemaining,
  eventIdForInviteLinkId,
  findEventInviteeByContact,
  getTierSoldQtyTx,
} from "./event-read.js";
import { isSessionProfileComplete } from "./participant-profile.js";
import { ensurePersonInTx } from "./people.js";
import { fulfillPaidOrderInTx } from "./fulfill-paid-order.js";
import { failOrderInTx } from "./order-failure.js";
import { resolveParticipantSessionFromCookie } from "./registration-session.js";

type CheckoutTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type SelectedTier = typeof eventTiers.$inferSelect;

const RESUMABLE_PI_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

async function findInviteLinkByRawTokenTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  rawToken: string,
) {
  const hash = sha256Hex(rawToken);
  const [row] = await tx
    .select({
      link: inviteLinks,
      event: events,
    })
    .from(inviteLinks)
    .innerJoin(events, eq(events.id, inviteLinks.eventId))
    .where(eq(inviteLinks.tokenHash, hash))
    .limit(1);
  return row ?? null;
}

export type CheckoutIntentInput = {
  slug: string;
  email: string | null;
  locale: "de" | "en" | "it";
  phoneE164: string | null;
  inviteToken: string | null;
  exclusiveTierId: string;
  addonTierIds: string[];
  cookieHeader: string | undefined;
};

function normalizedCheckoutEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase();
}

async function pendingOrderTierIdsMatchTx(
  tx: CheckoutTx,
  orderId: string,
  selectedTiers: SelectedTier[],
): Promise<boolean> {
  const lines = await tx
    .select({ eventTierId: orderTiers.eventTierId })
    .from(orderTiers)
    .where(eq(orderTiers.orderId, orderId));
  if (lines.length !== selectedTiers.length) {
    return false;
  }
  const orderTierIds = new Set(lines.map((line) => line.eventTierId));
  for (const tier of selectedTiers) {
    if (!orderTierIds.has(tier.id)) {
      return false;
    }
  }
  return true;
}

async function supersedePendingOrderTx(
  tx: CheckoutTx,
  order: typeof orders.$inferSelect,
): Promise<void> {
  if (order.stripePaymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
    } catch {
      /* already canceled or captured */
    }
  }
  await failOrderInTx(tx, order.id);
}

type ExistingOrderResolution =
  | { action: "continue" }
  | { action: "resume"; clientSecret: string; orderId: string }
  | { action: "blocked"; status: number; error: string };

async function resolveExistingOrderForCheckoutTx(
  tx: CheckoutTx,
  existingOrder: typeof orders.$inferSelect,
  selectedTiers: SelectedTier[],
): Promise<ExistingOrderResolution> {
  if (existingOrder.status === "paid") {
    return {
      action: "blocked",
      status: 409,
      error: "You are already registered for this event.",
    };
  }

  if (existingOrder.status !== "pending") {
    return { action: "continue" };
  }

  if (!existingOrder.stripePaymentIntentId) {
    await supersedePendingOrderTx(tx, existingOrder);
    return { action: "continue" };
  }

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(existingOrder.stripePaymentIntentId);
  } catch {
    await supersedePendingOrderTx(tx, existingOrder);
    return { action: "continue" };
  }

  if (pi.status === "succeeded") {
    await fulfillPaidOrderInTx(tx, {
      orderId: existingOrder.id,
      source: "client",
    });
    return {
      action: "blocked",
      status: 409,
      error: "Your payment is complete. Refresh the page to see your confirmation.",
    };
  }

  if (pi.status === "canceled") {
    await supersedePendingOrderTx(tx, existingOrder);
    return { action: "continue" };
  }

  if (
    RESUMABLE_PI_STATUSES.has(pi.status) &&
    pi.client_secret &&
    (await pendingOrderTierIdsMatchTx(tx, existingOrder.id, selectedTiers))
  ) {
    return {
      action: "resume",
      clientSecret: pi.client_secret,
      orderId: existingOrder.id,
    };
  }

  await supersedePendingOrderTx(tx, existingOrder);
  return { action: "continue" };
}

function uniqueAddonIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function createCheckoutIntent(input: CheckoutIntentInput): Promise<
  | { ok: true; clientSecret: string; orderId: string }
  | { ok: false; status: number; error: string }
> {
  const db = getDb();
  const exclusiveTierId = input.exclusiveTierId?.trim() ?? "";
  const addonTierIds = uniqueAddonIds(input.addonTierIds ?? []);

  const session = await resolveParticipantSessionFromCookie(input.cookieHeader);
  if (!session) {
    return { ok: false, status: 401, error: "Sign in and complete your profile first." };
  }
  const profileComplete = await isSessionProfileComplete(session);
  if (!profileComplete || !session.personId) {
    return {
      ok: false,
      status: 403,
      error: "Complete and verify your profile before checkout.",
    };
  }

  const [profilePerson] = await db
    .select()
    .from(people)
    .where(eq(people.id, session.personId))
    .limit(1);
  if (!profilePerson) {
    return { ok: false, status: 404, error: "Profile not found." };
  }

  try {
    return await db.transaction(async (tx) => {
      let normalizedPhone: string | null = null;
      if (input.phoneE164?.trim()) {
        normalizedPhone = normalizeOptionalPhoneE164(input.phoneE164);
        if (!normalizedPhone) {
          return { ok: false, status: 400, error: "Invalid phone number." };
        }
      }

      const [ev] = await tx
        .select()
        .from(events)
        .where(and(eq(events.slug, input.slug), eq(events.status, "published")))
        .limit(1);
      if (!ev) {
        return { ok: false, status: 404, error: "Event not found." };
      }
      let inviteLinkId: string | null = null;
      if (ev.accessMode === "invite_only") {
        let guestLinkId: string | null = null;
        let guestLinkMax: number | null = null;
        if (input.inviteToken) {
          const guest = await findInviteLinkByRawTokenTx(tx, input.inviteToken);
          if (!guest || guest.event.id !== ev.id) {
            return { ok: false, status: 403, error: "Invalid or expired invite." };
          }
          guestLinkId = guest.link.id;
          guestLinkMax = guest.link.maxRedemptions;
        }
        if (!guestLinkId && session.inviteLinkId) {
          const linkEventId = await eventIdForInviteLinkId(session.inviteLinkId);
          if (linkEventId === ev.id) {
            guestLinkId = session.inviteLinkId;
            const [linkRow] = await tx
              .select({ maxRedemptions: inviteLinks.maxRedemptions })
              .from(inviteLinks)
              .where(eq(inviteLinks.id, session.inviteLinkId))
              .limit(1);
            guestLinkMax = linkRow?.maxRedemptions ?? null;
          }
        }
        const checkoutEmailForEventInvite =
          profilePerson.email?.trim()?.toLowerCase() ??
          normalizedCheckoutEmail(input.email);
        const phoneDigits = phoneToStoredDigits(
          profilePerson.phone
            ? `+${profilePerson.phone.replace(/\D/g, "")}`
            : normalizedPhone,
        );
        if (!checkoutEmailForEventInvite && !phoneDigits) {
          return {
            ok: false,
            status: 400,
            error: "Email or phone is required.",
          };
        }
        const eventInvitee = await findEventInviteeByContact(
          ev.id,
          checkoutEmailForEventInvite ?? "",
          phoneDigits,
        );
        if (eventInvitee === "ambiguous") {
          return {
            ok: false,
            status: 400,
            error: "Multiple event invite matches — contact the organizer.",
          };
        }
        const isHost = eventInvitee !== null;
        const isGuest = guestLinkId !== null;
        if (!isHost && !isGuest) {
          return {
            ok: false,
            status: 403,
            error: "This event is invite-only. Use your invite link or invited email.",
          };
        }
        if (isGuest && guestLinkId && guestLinkMax != null) {
          inviteLinkId = guestLinkId;
          const used = await getInviteRedemptionQtyTx(tx, inviteLinkId);
          if (used + 1 > guestLinkMax) {
            return {
              ok: false,
              status: 409,
              error: "This invite link has no remaining places.",
            };
          }
        }
      }

      const activeTiers = await tx
        .select()
        .from(eventTiers)
        .where(and(eq(eventTiers.eventId, ev.id), eq(eventTiers.active, true)))
        .for("update");

      const hasExclusiveTiers = activeTiers.some((t) => t.selectionMode === "exclusive");
      if (hasExclusiveTiers && !exclusiveTierId) {
        return { ok: false, status: 400, error: "Select a contribution tier." };
      }
      if (!hasExclusiveTiers && addonTierIds.length === 0) {
        return { ok: false, status: 400, error: "Select at least one tier." };
      }

      const selectedIds = [
        ...(exclusiveTierId ? [exclusiveTierId] : []),
        ...addonTierIds,
      ];
      const tierById = new Map(activeTiers.map((t) => [t.id, t]));

      const selectedTiers: (typeof eventTiers.$inferSelect)[] = [];
      for (const id of selectedIds) {
        const tier = tierById.get(id);
        if (!tier) {
          return { ok: false, status: 400, error: "Unknown or inactive tier." };
        }
        selectedTiers.push(tier);
      }

      if (exclusiveTierId) {
        const exclusive = tierById.get(exclusiveTierId);
        if (!exclusive || exclusive.selectionMode !== "exclusive") {
          return { ok: false, status: 400, error: "Invalid contribution tier." };
        }
      }
      for (const id of addonTierIds) {
        const addon = tierById.get(id);
        if (!addon || addon.selectionMode !== "addon") {
          return { ok: false, status: 400, error: "Invalid add-on tier." };
        }
      }

      const headUsed = await getEventHeadcountUsedTx(tx, ev.id);
      const eventRemainingInit =
        ev.eventQuota != null ? Math.max(0, ev.eventQuota - headUsed) : null;
      const eventSlotsLeft =
        eventRemainingInit != null ? eventRemainingInit : Number.POSITIVE_INFINITY;
      const eventRemCur = Number.isFinite(eventSlotsLeft) ? eventSlotsLeft : null;

      if (eventRemCur != null && eventRemCur < 1) {
        return {
          ok: false,
          status: 409,
          error: "This event is sold out.",
        };
      }

      for (const tier of selectedTiers) {
        const sold = await getTierSoldQtyTx(tx, ev.id, tier.id);
        const placesCap = computeTierPlacesRemaining({
          tierQuota: tier.quota,
          sold,
          eventRemaining: eventRemCur,
        });
        const capForCompare = placesCap == null ? Number.POSITIVE_INFINITY : placesCap;
        if (1 > capForCompare) {
          return {
            ok: false,
            status: 409,
            error: `Not enough places remaining for "${tier.name}".`,
          };
        }
      }

      const checkoutEmail =
        profilePerson.email?.trim()?.toLowerCase() ??
        normalizedCheckoutEmail(input.email);
      const profilePhoneE164 = profilePerson.phone
        ? `+${profilePerson.phone.replace(/\D/g, "")}`
        : null;
      const checkoutPhone = profilePhoneE164 ?? normalizedPhone;
      if (!checkoutEmail && !checkoutPhone) {
        return {
          ok: false,
          status: 400,
          error: "Email or phone is required.",
        };
      }

      let personId: string;
      try {
        personId = await ensurePersonInTx(tx, {
          givenName: profilePerson.givenName,
          familyName: profilePerson.familyName,
          email: checkoutEmail,
          phoneE164: checkoutPhone,
        });
      } catch (e) {
        if (e instanceof Error && e.message === "identity_conflict") {
          return {
            ok: false,
            status: 409,
            error: "Contact details conflict with another profile.",
          };
        }
        throw e;
      }

      if (personId !== session.personId) {
        return {
          ok: false,
          status: 409,
          error: "Profile mismatch — refresh and try again.",
        };
      }

      const [existingOrder] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.eventId, ev.id),
            eq(orders.personId, personId),
            inArray(orders.status, ["pending", "paid"]),
          ),
        )
        .limit(1);

      if (existingOrder) {
        const resolved = await resolveExistingOrderForCheckoutTx(
          tx,
          existingOrder,
          selectedTiers,
        );
        if (resolved.action === "blocked") {
          return { ok: false, status: resolved.status, error: resolved.error };
        }
        if (resolved.action === "resume") {
          return {
            ok: true,
            clientSecret: resolved.clientSecret,
            orderId: resolved.orderId,
          };
        }
      }

      const amountCents = selectedTiers.reduce((sum, t) => sum + t.priceCents, 0);
      const currency = selectedTiers[0]!.currency.toLowerCase();
      const mixedCurrency = selectedTiers.some(
        (t) => t.currency.toLowerCase() !== currency,
      );
      if (mixedCurrency) {
        return { ok: false, status: 400, error: "Selected tiers use different currencies." };
      }

      const [orderRow] = await tx
        .insert(orders)
        .values({
          eventId: ev.id,
          personId,
          locale: input.locale,
          amountCents,
          status: "pending",
          inviteLinkId,
        })
        .returning({ id: orders.id });
      const orderId = orderRow!.id;

      await tx.insert(orderTiers).values(
        selectedTiers.map((tier) => ({
          orderId,
          eventTierId: tier.id,
          unitPriceCents: tier.priceCents,
        })),
      );

      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        metadata: { orderId, eventId: ev.id },
        automatic_payment_methods: { enabled: true },
      });
      await tx
        .update(orders)
        .set({
          stripePaymentIntentId: pi.id,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
      return {
        ok: true,
        clientSecret: pi.client_secret!,
        orderId,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed.";
    return { ok: false, status: 500, error: msg };
  }
}

async function getEventHeadcountUsedTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  eventId: string,
): Promise<number> {
  const [row] = await tx
    .select({
      qty: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(eq(orders.eventId, eventId), inArray(orders.status, ["pending", "paid"])),
    );
  return Number(row?.qty ?? 0);
}

async function getInviteRedemptionQtyTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  inviteLinkId: string,
): Promise<number> {
  const [row] = await tx
    .select({
      qty: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.inviteLinkId, inviteLinkId),
        inArray(orders.status, ["pending", "paid"]),
      ),
    );
  return Number(row?.qty ?? 0);
}
