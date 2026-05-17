import { eq } from "drizzle-orm";

import { getDb } from "../../db/index.js";
import { orders } from "../../db/schema.js";

const DELETABLE_STATUSES = new Set<typeof orders.$inferSelect.status>(["pending", "failed"]);

export async function deleteUnpaidAdminOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return { ok: false, status: 404, error: "Order not found." };
  }
  if (!DELETABLE_STATUSES.has(order.status)) {
    return {
      ok: false,
      status: 400,
      error: "Only pending or failed orders can be deleted. Refund paid orders instead.",
    };
  }

  await db.delete(orders).where(eq(orders.id, orderId));
  return { ok: true };
}
