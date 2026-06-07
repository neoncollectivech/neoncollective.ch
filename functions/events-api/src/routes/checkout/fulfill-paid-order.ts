import { createLogger } from "@neon/server-kit";
import type Stripe from "stripe";

import type { EntityTx } from "../../services/transaction";
import { admissionsService } from "../../services/admissions.service";
import { eventInviteesService } from "../../services/event-invitees.service";
import { eventRegistrationsService } from "../../services/event-registrations.service";
import { eventsService } from "../../services/events.service";
import {
  ensureHostInviteLinkForPersonInTx,
} from "../shared/invite-links-orchestration";
import { inviteLinksService } from "../../services/invite-links.service";
import { inviteRedemptionsService } from "../../services/invite-redemptions.service";
import { promotionCodeRedemptionsService } from "../../services/promotion-code-redemptions.service";
import { orderTiersService } from "../../services/order-tiers.service";
import { ordersService } from "../../services/orders.service";
import { peopleService } from "../../services/people.service";
import { stripeEventsProcessedService } from "../../services/stripe-events-processed.service";
import { sumupEventsProcessedService } from "../../services/sumup-events-processed.service";
import { runTransaction } from "../../services/transaction";

const log = createLogger("fulfill-paid-order");

export type PostCheckoutEmailJob = {
  personId: string;
  email: string;
  locale: "de" | "en" | "it";
  eventSlug: string;
  accessMode: "public" | "invite_only";
};

export type FulfillPaidOrderSource = "client" | "webhook" | "sumup_webhook" | "sumup_poll";

export type FulfillPaidOrderResult =
  | { kind: "send_email"; job: PostCheckoutEmailJob }
  | { kind: "noop" }
  | { kind: "failed"; reason: string };

type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.getInTx>>>;

async function issueAdmissionForPaidOrderInTx(
  tx: EntityTx,
  orderId: string,
): Promise<boolean> {
  const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId, tx);
  if (tierIds.length === 0) {
    return true;
  }

  const result = await admissionsService.issueAdmissionForPaidOrderInTx(tx, orderId);
  if (!result.ok) {
    log.error({ orderId, reason: result.reason }, "Admission issuance failed");
    return false;
  }

  return true;
}

async function ensureEventInviteeFromGuestCheckoutInTx(
  tx: EntityTx,
  order: OrderRow,
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
  order: OrderRow,
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

function orderEligibleForFulfillment(
  order: OrderRow,
  paymentIntentStatus?: Stripe.PaymentIntent.Status,
): boolean {
  if (order.status === "pending") {
    return true;
  }
  if (order.status === "failed" && paymentIntentStatus === "succeeded") {
    return true;
  }
  return false;
}

function buildEmailJob(
  order: OrderRow,
  ev: NonNullable<Awaited<ReturnType<typeof eventsService.getInTx>>>,
  person: NonNullable<Awaited<ReturnType<typeof peopleService.getInTx>>>,
): PostCheckoutEmailJob | null {
  const email = person.email?.trim() ?? null;
  if (!email) {
    return null;
  }
  const locale =
    order.locale === "de" ? "de" : order.locale === "it" ? "it" : "en";
  return {
    personId: order.personId,
    email,
    locale,
    eventSlug: ev.slug,
    accessMode: ev.accessMode,
  };
}

/** Idempotent admission, redemption, and invitee rows for an already-paid order. */
async function repairPaidOrderFulfillmentInTx(
  tx: EntityTx,
  order: OrderRow,
): Promise<boolean> {
  const tierIds = await orderTiersService.getEventTierIdsForOrder(order.id, tx);
  if (tierIds.length > 0) {
    const registrationSync = await eventRegistrationsService.syncForPaidOrderInTx(tx, order);
    if (!registrationSync.ok) {
      log.error({ orderId: order.id }, "Registration sync failed for paid order");
      return false;
    }

    const issued = await issueAdmissionForPaidOrderInTx(tx, order.id);
    if (!issued) {
      return false;
    }
    log.warn({ orderId: order.id }, "Repaired admission credential for paid order");
  }

  const person = await peopleService.getInTx(tx, order.personId);
  const ev = await eventsService.getInTx(tx, order.eventId);

  if (person) {
    await eventInviteesService.syncEventInviteesToPersonInTx(tx, order.personId, {
      email: person.email?.trim().toLowerCase() ?? null,
      phone: person.phone ?? null,
    });
  }

  if (order.inviteLinkId) {
    const redemption = await inviteRedemptionsService.findByOrderId(order.id, tx);
    if (!redemption) {
      await inviteRedemptionsService.insertInTx(tx, {
        inviteLinkId: order.inviteLinkId,
        orderId: order.id,
      });
    }
  }

  if (order.promotionCodeId) {
    const promoRedemption = await promotionCodeRedemptionsService.findByOrderId(order.id, tx);
    if (!promoRedemption) {
      await promotionCodeRedemptionsService.insertInTx(tx, {
        promotionCodeId: order.promotionCodeId,
        orderId: order.id,
      });
    }
  }

  if (ev && person) {
    await ensureEventInviteeFromGuestCheckoutInTx(tx, order, ev, person);
    if (await shouldMintHostInviteLinkForOrderInTx(tx, order)) {
      await ensureHostInviteLinkForPersonInTx(tx, order.eventId, order.personId);
    }
  }

  return true;
}

async function applyCheckoutFulfillmentSideEffectsInTx(
  tx: EntityTx,
  order: OrderRow,
): Promise<boolean> {
  const person = await peopleService.getInTx(tx, order.personId);

  if (person) {
    await eventInviteesService.syncEventInviteesToPersonInTx(tx, order.personId, {
      email: person.email?.trim().toLowerCase() ?? null,
      phone: person.phone ?? null,
    });
  }

  await ordersService.markPaidInTx(tx, order.id);

  const paidOrder = await ordersService.getInTx(tx, order.id);
  if (!paidOrder) {
    return false;
  }

  const registrationSync = await eventRegistrationsService.syncForPaidOrderInTx(tx, paidOrder);
  if (!registrationSync.ok) {
    log.error({ orderId: order.id, reason: registrationSync.reason }, "Registration sync failed");
    return false;
  }

  const admissionOk = await issueAdmissionForPaidOrderInTx(tx, order.id);
  if (!admissionOk) {
    return false;
  }

  if (order.inviteLinkId) {
    await inviteRedemptionsService.insertInTx(tx, {
      inviteLinkId: order.inviteLinkId,
      orderId: order.id,
    });
  }

  if (order.promotionCodeId) {
    await promotionCodeRedemptionsService.insertInTx(tx, {
      promotionCodeId: order.promotionCodeId,
      orderId: order.id,
    });
  }

  const ev = await eventsService.getInTx(tx, order.eventId);
  if (ev && person) {
    await ensureEventInviteeFromGuestCheckoutInTx(tx, order, ev, person);
    if (await shouldMintHostInviteLinkForOrderInTx(tx, order)) {
      await ensureHostInviteLinkForPersonInTx(tx, order.eventId, order.personId);
    }
  }

  return true;
}

async function finalizeFulfillmentInTx(
  tx: EntityTx,
  order: OrderRow,
  params: {
    source: FulfillPaidOrderSource;
    stripeEventId?: string;
    sumupEventId?: string;
    fulfillmentCompleted: boolean;
  },
): Promise<FulfillPaidOrderResult> {
  if (params.source === "webhook" && params.stripeEventId && params.fulfillmentCompleted) {
    await stripeEventsProcessedService.claimInTx(tx, params.stripeEventId);
  }
  if (params.source === "sumup_webhook" && params.sumupEventId && params.fulfillmentCompleted) {
    await sumupEventsProcessedService.claimInTx(tx, params.sumupEventId);
  }

  const ev = await eventsService.getInTx(tx, order.eventId);
  const person = await peopleService.getInTx(tx, order.personId);
  if (!ev || !person) {
    return { kind: "noop" };
  }

  const job = buildEmailJob(order, ev, person);
  if (!job) {
    log.warn(
      { orderId: order.id, personId: order.personId },
      "Skipping confirmation email — person has no email on file",
    );
    return { kind: "noop" };
  }

  const maySendEmail = await ordersService.trySetAccessEmailSentAtInTx(tx, order.id);
  if (!maySendEmail) {
    return { kind: "noop" };
  }

  log.info({ orderId: order.id, source: params.source }, "Order fulfilled");
  return { kind: "send_email", job };
}

async function runAlreadyFulfilledPathInTx(
  tx: EntityTx,
  order: OrderRow,
  params: {
    source: FulfillPaidOrderSource;
    stripeEventId?: string;
  },
): Promise<FulfillPaidOrderResult> {
  const repaired = await repairPaidOrderFulfillmentInTx(tx, order);
  if (!repaired) {
    return { kind: "failed", reason: "Could not repair paid order fulfillment." };
  }
  if (order.status !== "paid") {
    await ordersService.markPaidInTx(tx, order.id);
  }
  await ordersService.trySetCheckoutFulfilledAtInTx(tx, order.id);
  return finalizeFulfillmentInTx(tx, order, {
    source: params.source,
    stripeEventId: params.stripeEventId,
    fulfillmentCompleted: true,
  });
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
    sumupEventId?: string;
    paymentIntentStatus?: Stripe.PaymentIntent.Status;
    stripePaymentIntentAmountCents?: number;
  },
): Promise<FulfillPaidOrderResult> {
  if (params.source === "webhook" && params.stripeEventId) {
    if (await stripeEventsProcessedService.isProcessedInTx(tx, params.stripeEventId)) {
      log.info({ eventId: params.stripeEventId }, "Duplicate webhook — skipping fulfillment");
      return { kind: "noop" };
    }
  }
  if (params.source === "sumup_webhook" && params.sumupEventId) {
    if (await sumupEventsProcessedService.isProcessedInTx(tx, params.sumupEventId)) {
      log.info({ eventId: params.sumupEventId }, "Duplicate SumUp webhook — skipping fulfillment");
      return { kind: "noop" };
    }
  }

  const order = await ordersService.getInTx(tx, params.orderId);
  if (!order) {
    log.error({ orderId: params.orderId }, "Order not found for fulfillment");
    return { kind: "failed", reason: "Order not found." };
  }

  if (order.checkoutFulfilledAt) {
    return runAlreadyFulfilledPathInTx(tx, order, params);
  }

  if (order.status === "paid") {
    return runAlreadyFulfilledPathInTx(tx, order, params);
  }

  if (!orderEligibleForFulfillment(order, params.paymentIntentStatus)) {
    log.warn(
      { orderId: order.id, status: order.status },
      "Order not eligible for checkout fulfillment",
    );
    return { kind: "failed", reason: `Order status ${order.status} is not fulfillable.` };
  }

  if (
    params.stripePaymentIntentAmountCents != null &&
    order.amountCents > 0 &&
    params.stripePaymentIntentAmountCents !== order.amountCents
  ) {
    log.error(
      {
        orderId: order.id,
        expectedAmountCents: order.amountCents,
        paymentIntentAmountCents: params.stripePaymentIntentAmountCents,
      },
      "Stripe payment intent amount mismatch",
    );
    return { kind: "failed", reason: "Payment amount mismatch." };
  }

  const sideEffectsOk = await applyCheckoutFulfillmentSideEffectsInTx(tx, order);
  if (!sideEffectsOk) {
    return { kind: "failed", reason: "Admission signing key missing or issuance failed." };
  }

  const markedFulfilled = await ordersService.trySetCheckoutFulfilledAtInTx(tx, order.id);
  if (!markedFulfilled) {
    const refreshed = await ordersService.getInTx(tx, order.id);
    if (!refreshed) {
      return { kind: "failed", reason: "Order not found after fulfillment race." };
    }
    return runAlreadyFulfilledPathInTx(tx, refreshed, params);
  }

  return finalizeFulfillmentInTx(tx, order, {
    source: params.source,
    stripeEventId: params.stripeEventId,
    sumupEventId: params.sumupEventId,
    fulfillmentCompleted: true,
  });
}

export async function fulfillPaidOrder(params: {
  orderId: string;
  source: FulfillPaidOrderSource;
  stripeEventId?: string;
  sumupEventId?: string;
  paymentIntentStatus?: Stripe.PaymentIntent.Status;
  stripePaymentIntentAmountCents?: number;
}): Promise<FulfillPaidOrderResult> {
  return runTransaction((tx) => fulfillPaidOrderInTx(tx, params));
}

export async function fulfillPaidOrderFromSumup(params: {
  orderId: string;
  source: "sumup_webhook" | "sumup_poll";
  sumupEventId?: string;
}): Promise<FulfillPaidOrderResult> {
  return fulfillPaidOrder({
    orderId: params.orderId,
    source: params.source,
    sumupEventId: params.sumupEventId,
  });
}
