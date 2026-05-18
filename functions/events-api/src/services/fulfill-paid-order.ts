import { randomBytes } from "node:crypto";

import { createLogger } from "@neon/server-kit";
import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../db/index.js";
import {
  admissions,
  eventInvitees,
  events,
  inviteLinks,
  inviteRedemptions,
  orders,
  people,
} from "../db/schema.js";
import { getExclusiveTierIdForOrderTx } from "./event-read.js";
import { claimStripeWebhookEventTx } from "./order-failure.js";
import { ensureHostInviteLinkForPersonInTx } from "./host-invite-link.js";

const log = createLogger("fulfill-paid-order");

function randomAdmissionToken(): string {
  return randomBytes(16).toString("hex");
}

export type PostCheckoutEmailJob = {
  personId: string;
  email: string;
  locale: "de" | "en" | "it";
  eventSlug: string;
  accessMode: "public" | "invite_only";
};

export type FulfillPaidOrderSource = "client" | "webhook";

type FulfillTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Record a paid guest event invite with lineage from the host link they used. */
async function ensureEventInviteeFromGuestCheckoutInTx(
  tx: FulfillTx,
  order: typeof orders.$inferSelect,
  ev: typeof events.$inferSelect,
  person: typeof people.$inferSelect,
): Promise<void> {
  if (ev.accessMode !== "invite_only" || !order.inviteLinkId) {
    return;
  }

  const [link] = await tx
    .select({ inviterId: inviteLinks.inviterId })
    .from(inviteLinks)
    .where(eq(inviteLinks.id, order.inviteLinkId))
    .limit(1);
  if (!link?.inviterId) {
    return;
  }

  const [existing] = await tx
    .select({ id: eventInvitees.id })
    .from(eventInvitees)
    .where(
      and(
        eq(eventInvitees.eventId, order.eventId),
        eq(eventInvitees.personId, order.personId),
        isNull(eventInvitees.revokedAt),
      ),
    )
    .limit(1);
  if (existing) {
    return;
  }

  await tx.insert(eventInvitees).values({
    eventId: order.eventId,
    personId: order.personId,
    inviterId: link.inviterId,
    email: person.email?.trim().toLowerCase() ?? null,
    phone: person.phone ?? null,
  });
}

/** Host share links are only for first-degree invitees, not guests who paid via someone else's link. */
async function shouldMintHostInviteLinkForOrderInTx(
  tx: FulfillTx,
  order: typeof orders.$inferSelect,
): Promise<boolean> {
  if (!order.inviteLinkId) {
    return true;
  }
  const [link] = await tx
    .select({ inviterId: inviteLinks.inviterId })
    .from(inviteLinks)
    .where(eq(inviteLinks.id, order.inviteLinkId))
    .limit(1);
  if (!link?.inviterId) {
    return true;
  }
  return link.inviterId === order.personId;
}

/**
 * Idempotently mark a pending order paid and create admission + invite redemption.
 * Safe to call from the browser confirm path and from the Stripe webhook (either order).
 */
export async function fulfillPaidOrderInTx(
  tx: FulfillTx,
  params: {
    orderId: string;
    source: FulfillPaidOrderSource;
    stripeEventId?: string;
  },
): Promise<PostCheckoutEmailJob | null> {
  if (params.source === "webhook" && params.stripeEventId) {
    const claimed = await claimStripeWebhookEventTx(tx, params.stripeEventId);
    if (!claimed) {
      log.info({ eventId: params.stripeEventId }, "Duplicate webhook — skipping fulfillment");
      return null;
    }
  }

  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);
  if (!order) {
    log.error({ orderId: params.orderId }, "Order not found for fulfillment");
    return null;
  }

  const [existingAdmission] = await tx
    .select({ id: admissions.id })
    .from(admissions)
    .where(eq(admissions.orderId, order.id))
    .limit(1);

  if (order.status === "paid") {
    if (!existingAdmission) {
      const exclusiveTierId = await getExclusiveTierIdForOrderTx(tx, order.id);
      if (!exclusiveTierId) {
        log.error({ orderId: order.id }, "Paid order missing exclusive tier for admission");
        return null;
      }
      await tx.insert(admissions).values({
        publicToken: randomAdmissionToken(),
        eventId: order.eventId,
        eventTierId: exclusiveTierId,
        orderId: order.id,
      });
      log.warn({ orderId: order.id }, "Repaired missing admission for paid order");
    }
    return null;
  }

  if (order.status !== "pending") {
    log.warn(
      { orderId: order.id, status: order.status },
      "Skipping fulfillment — order not pending",
    );
    return null;
  }

  const [person] = await tx
    .select()
    .from(people)
    .where(eq(people.id, order.personId))
    .limit(1);

  await tx
    .update(orders)
    .set({ status: "paid", updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  const [ev] = await tx
    .select()
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1);

  if (!existingAdmission) {
    const exclusiveTierId = await getExclusiveTierIdForOrderTx(tx, order.id);
    if (!exclusiveTierId) {
      log.error({ orderId: order.id }, "Order missing exclusive tier for admission");
      return null;
    }
    await tx.insert(admissions).values({
      publicToken: randomAdmissionToken(),
      eventId: order.eventId,
      eventTierId: exclusiveTierId,
      orderId: order.id,
    });
  }

  if (order.inviteLinkId) {
    await tx
      .insert(inviteRedemptions)
      .values({
        inviteLinkId: order.inviteLinkId,
        orderId: order.id,
      })
      .onConflictDoNothing();
  }

  if (ev && person) {
    await ensureEventInviteeFromGuestCheckoutInTx(tx, order, ev, person);
    if (await shouldMintHostInviteLinkForOrderInTx(tx, order)) {
      await ensureHostInviteLinkForPersonInTx(tx, order.eventId, order.personId);
    }
  }

  if (!ev) {
    return null;
  }

  const locale =
    order.locale === "de" ? "de" : order.locale === "it" ? "it" : "en";
  const email = person?.email?.trim() ?? null;
  if (!email) {
    log.warn(
      { orderId: order.id, personId: order.personId },
      "Skipping confirmation email — person has no email on file",
    );
    return null;
  }

  log.info({ orderId: order.id, source: params.source }, "Order fulfilled");

  return {
    personId: order.personId,
    email,
    locale,
    eventSlug: ev.slug,
    accessMode: ev.accessMode,
  };
}

export async function fulfillPaidOrder(params: {
  orderId: string;
  source: FulfillPaidOrderSource;
  stripeEventId?: string;
}): Promise<PostCheckoutEmailJob | null> {
  const db = getDb();
  return db.transaction((tx) => fulfillPaidOrderInTx(tx, params));
}
