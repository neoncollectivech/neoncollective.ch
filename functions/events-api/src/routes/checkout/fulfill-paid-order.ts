import { createLogger } from "@neon/server-kit";

import type { EntityTx } from "../../services/transaction";
import { admissionsService } from "../../services/admissions.service";
import { eventInviteesService } from "../../services/event-invitees.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { eventsService } from "../../services/events.service";
import {
  ensureHostInviteLinkForPersonInTx,
} from "../shared/invite-links-orchestration";
import { inviteLinksService } from "../../services/invite-links.service";
import { inviteRedemptionsService } from "../../services/invite-redemptions.service";
import { orderTiersService } from "../../services/order-tiers.service";
import { ordersService } from "../../services/orders.service";
import { peopleService } from "../../services/people.service";
import { stripeEventsProcessedService } from "../../services/stripe-events-processed.service";
import { runTransaction } from "../../services/transaction";

const log = createLogger("fulfill-paid-order");

export type PostCheckoutEmailJob = {
  personId: string;
  email: string;
  locale: "de" | "en" | "it";
  eventSlug: string;
  accessMode: "public" | "invite_only";
};

export type FulfillPaidOrderSource = "client" | "webhook";

async function resolveExclusiveTierIdForOrder(
  tx: EntityTx,
  orderId: string,
): Promise<string | null> {
  const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId, tx);
  return eventTiersService.findExclusiveTierIdAmong(tierIds, tx);
}

async function createAdmissionForOrderInTx(
  tx: EntityTx,
  orderId: string,
  eventId: string,
): Promise<boolean> {
  const eventTierId = await resolveExclusiveTierIdForOrder(tx, orderId);
  if (!eventTierId) {
    return false;
  }
  await admissionsService.createForPaidOrderInTx(tx, {
    orderId,
    eventId,
    eventTierId,
  });
  return true;
}

async function ensureEventInviteeFromGuestCheckoutInTx(
  tx: EntityTx,
  order: NonNullable<Awaited<ReturnType<typeof ordersService.getInTx>>>,
  ev: NonNullable<Awaited<ReturnType<typeof eventsService.getInTx>>>,
  person: NonNullable<Awaited<ReturnType<typeof peopleService.getInTx>>>,
): Promise<void> {
  if (ev.accessMode !== "invite_only" || !order.inviteLinkId) {
    return;
  }

  const inviterId = await inviteLinksService.getInviterIdInTx(tx, order.inviteLinkId);
  if (!inviterId) {
    return;
  }

  await eventInviteesService.linkOrCreateGuestInviteeFromCheckoutInTx(tx, {
    eventId: order.eventId,
    personId: order.personId,
    inviterId,
    email: person.email?.trim().toLowerCase() ?? null,
    phone: person.phone ?? null,
  });
}

async function shouldMintHostInviteLinkForOrderInTx(
  tx: EntityTx,
  order: NonNullable<Awaited<ReturnType<typeof ordersService.getInTx>>>,
): Promise<boolean> {
  if (!order.inviteLinkId) {
    return true;
  }
  const inviterId = await inviteLinksService.getInviterIdInTx(tx, order.inviteLinkId);
  if (!inviterId) {
    return true;
  }
  return inviterId === order.personId;
}

/**
 * Idempotently mark a pending order paid and create admission + invite redemption.
 * Safe to call from the browser confirm path and from the Stripe webhook (either order).
 */
export async function fulfillPaidOrderInTx(
  tx: EntityTx,
  params: {
    orderId: string;
    source: FulfillPaidOrderSource;
    stripeEventId?: string;
  },
): Promise<PostCheckoutEmailJob | null> {
  if (params.source === "webhook" && params.stripeEventId) {
    const claimed = await stripeEventsProcessedService.claimInTx(
      tx,
      params.stripeEventId,
    );
    if (!claimed) {
      log.info({ eventId: params.stripeEventId }, "Duplicate webhook — skipping fulfillment");
      return null;
    }
  }

  const order = await ordersService.getInTx(tx, params.orderId);
  if (!order) {
    log.error({ orderId: params.orderId }, "Order not found for fulfillment");
    return null;
  }

  const existingAdmission = await admissionsService.findIdByOrderInTx(tx, order.id);

  if (order.status === "paid") {
    if (!existingAdmission) {
      const created = await createAdmissionForOrderInTx(tx, order.id, order.eventId);
      if (!created) {
        log.error({ orderId: order.id }, "Paid order missing exclusive tier for admission");
        return null;
      }
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

  const person = await peopleService.getInTx(tx, order.personId);

  if (person) {
    await eventInviteesService.syncEventInviteesToPersonInTx(tx, order.personId, {
      email: person.email?.trim().toLowerCase() ?? null,
      phone: person.phone ?? null,
    });
  }

  await ordersService.markPaidInTx(tx, order.id);

  const ev = await eventsService.getInTx(tx, order.eventId);

  if (!existingAdmission) {
    const created = await createAdmissionForOrderInTx(tx, order.id, order.eventId);
    if (!created) {
      log.error({ orderId: order.id }, "Order missing exclusive tier for admission");
      return null;
    }
  }

  if (order.inviteLinkId) {
    await inviteRedemptionsService.insertInTx(tx, {
      inviteLinkId: order.inviteLinkId,
      orderId: order.id,
    });
  }

  if (ev && person) {
    await ensureEventInviteeFromGuestCheckoutInTx(tx, order, ev, person);
    if (await shouldMintHostInviteLinkForOrderInTx(tx, order)) {
      await ensureHostInviteLinkForPersonInTx(
        tx,
        order.eventId,
        order.personId,
      );
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
  return runTransaction((tx) => fulfillPaidOrderInTx(tx, params));
}
