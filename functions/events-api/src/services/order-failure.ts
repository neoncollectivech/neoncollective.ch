import { createLogger } from "@neon/server-kit";
import { eq } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { orders, stripeEventsProcessed } from "../db/schema.js";

const log = createLogger("order-failure");

export type OrderTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Returns false when this Stripe event id was already processed. */
export async function claimStripeWebhookEventTx(
  tx: OrderTx,
  stripeEventId: string,
): Promise<boolean> {
  const inserted = await tx
    .insert(stripeEventsProcessed)
    .values({ stripeEventId })
    .onConflictDoNothing()
    .returning({ id: stripeEventsProcessed.stripeEventId });
  return inserted.length > 0;
}

export async function failOrderInTx(
  tx: OrderTx,
  orderId: string,
): Promise<"failed" | "already_terminal" | "not_found"> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return "not_found";
  }
  if (order.status !== "pending") {
    return "already_terminal";
  }
  await tx
    .update(orders)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  return "failed";
}

export async function failOrderFromWebhook(params: {
  orderId: string;
  stripeEventId: string;
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const claimed = await claimStripeWebhookEventTx(tx, params.stripeEventId);
    if (!claimed) {
      log.info({ eventId: params.stripeEventId }, "Duplicate webhook — skipping fail order");
      return;
    }
    const result = await failOrderInTx(tx, params.orderId);
    if (result === "not_found") {
      log.warn({ orderId: params.orderId }, "Order not found for fail webhook");
      return;
    }
    if (result === "failed") {
      log.info({ orderId: params.orderId, eventId: params.stripeEventId }, "Order marked failed");
    }
  });
}
