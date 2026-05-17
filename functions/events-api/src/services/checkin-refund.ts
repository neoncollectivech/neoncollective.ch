import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { admissions, inviteRedemptions, orders } from "../db/schema.js";
import { stripe } from "../stripe.js";

export function verifyStaffBearer(
  header: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !header?.startsWith("Bearer ")) {
    return false;
  }
  const token = header.slice("Bearer ".length).trim();
  return token === expected;
}

export async function checkInAdmission(params: {
  token: string;
  staffLabel: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(admissions)
    .where(
      and(
        eq(admissions.publicToken, params.token),
        isNull(admissions.revokedAt),
        isNull(admissions.checkedInAt),
      ),
    )
    .limit(1);
  if (!row) {
    return { ok: false, status: 404, error: "Place not found or already checked in." };
  }
  await db
    .update(admissions)
    .set({
      checkedInAt: new Date(),
      checkedInBy: params.staffLabel,
    })
    .where(eq(admissions.id, row.id));
  return { ok: true };
}

export async function refundOrder(params: {
  orderId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);
  if (!order) {
    return { ok: false, status: 404, error: "Order not found." };
  }
  if (order.status !== "paid" || !order.stripePaymentIntentId) {
    return { ok: false, status: 400, error: "Order cannot be refunded in its current state." };
  }
  try {
    await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe refund failed";
    return { ok: false, status: 502, error: msg };
  }
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    await tx
      .update(admissions)
      .set({ revokedAt: new Date() })
      .where(and(eq(admissions.orderId, order.id), isNull(admissions.revokedAt)));
    await tx.delete(inviteRedemptions).where(eq(inviteRedemptions.orderId, order.id));
  });
  return { ok: true };
}
