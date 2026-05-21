import {
  defineFilterable,
  filterable,
  introspectPgTable,
  parseListQuery,
  type InferFilterParams,
} from "@neon/admin-crud";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { orders } from "../db/schema";
import type { EntityTx } from "./transaction";
import { TableService } from "./base";

export const ordersFilterable = defineFilterable([
  filterable("eventId", orders.eventId),
  filterable("status", orders.status),
] as const);

export type OrdersListFilters = InferFilterParams<typeof ordersFilterable>;

export type OrderTx = EntityTx;

const ordersMeta = introspectPgTable(orders);

export class OrdersService extends TableService<
  typeof orders,
  typeof orders.$inferSelect,
  Record<string, unknown>,
  Record<string, unknown>,
  OrdersListFilters
> {
  constructor() {
    super({
      table: orders,
      meta: ordersMeta,
      filterable: ordersFilterable,
    });
  }

  async failOrderInTx(
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

  async findPendingOrPaidForPersonOnEventInTx(
    tx: OrderTx,
    eventId: string,
    personId: string,
  ): Promise<typeof orders.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.eventId, eventId),
          eq(orders.personId, personId),
          inArray(orders.status, ["pending", "paid"]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createPendingOrderInTx(
    tx: OrderTx,
    params: {
      eventId: string;
      personId: string;
      locale: string;
      amountCents: number;
      inviteLinkId: string | null;
    },
  ): Promise<string> {
    const [row] = await tx
      .insert(orders)
      .values({
        eventId: params.eventId,
        personId: params.personId,
        locale: params.locale,
        amountCents: params.amountCents,
        status: "pending",
        inviteLinkId: params.inviteLinkId,
      })
      .returning({ id: orders.id });
    return row!.id;
  }

  async attachStripePaymentIntentInTx(
    tx: OrderTx,
    orderId: string,
    stripePaymentIntentId: string,
  ): Promise<void> {
    await tx
      .update(orders)
      .set({
        stripePaymentIntentId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  async getInTx(tx: OrderTx, orderId: string): Promise<typeof orders.$inferSelect | null> {
    const [row] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return row ?? null;
  }

  async hasOrderForPerson(personId: string): Promise<boolean> {
    const db = getDb();
    const [row] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.personId, personId))
      .limit(1);
    return Boolean(row);
  }

  async countPendingOrPaidForEvent(eventId: string, tx?: OrderTx): Promise<number> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({
        qty: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(eq(orders.eventId, eventId), inArray(orders.status, ["pending", "paid"])),
      );
    return Number(row?.qty ?? 0);
  }

  async countPendingOrPaidForInviteLink(
    inviteLinkId: string,
    tx?: OrderTx,
  ): Promise<number> {
    const executor = tx ?? getDb();
    const [row] = await executor
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

  async countPendingOrPaidForInviteLinkIds(
    inviteLinkIds: string[],
    tx?: OrderTx,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (inviteLinkIds.length === 0) {
      return out;
    }
    const executor = tx ?? getDb();
    const rows = await executor
      .select({
        inviteLinkId: orders.inviteLinkId,
        qty: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.inviteLinkId, inviteLinkIds),
          inArray(orders.status, ["pending", "paid"]),
        ),
      )
      .groupBy(orders.inviteLinkId);
    for (const row of rows) {
      if (row.inviteLinkId) {
        out.set(row.inviteLinkId, Number(row.qty ?? 0));
      }
    }
    return out;
  }

  async markRefundedInTx(tx: OrderTx, orderId: string): Promise<void> {
    await tx
      .update(orders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }

  async markPaidInTx(tx: OrderTx, orderId: string): Promise<void> {
    await tx
      .update(orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }

  async getByStripePaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<typeof orders.$inferSelect | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.stripePaymentIntentId, stripePaymentIntentId))
      .limit(1);
    return row ?? null;
  }

  async findLatestPaidOrderIdForPersonOnEvent(
    eventId: string,
    personId: string,
  ): Promise<string | null> {
    const db = getDb();
    const [row] = await db
      .select({ orderId: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.eventId, eventId),
          eq(orders.personId, personId),
          eq(orders.status, "paid"),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);
    return row?.orderId ?? null;
  }

  async deleteDeletableAdminOrder(
    orderId: string,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: "order_not_found" | "order_not_deletable" }
  > {
    const deletable = new Set<typeof orders.$inferSelect.status>(["pending", "failed"]);
    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return { ok: false, reason: "order_not_found" };
    }
    if (!deletable.has(order.status)) {
      return { ok: false, reason: "order_not_deletable" };
    }
    await db.delete(orders).where(eq(orders.id, orderId));
    return { ok: true };
  }

  parseListQuery(raw: Record<string, string | string[] | undefined>) {
    return parseListQuery<OrdersListFilters>(raw);
  }

  async listIdsByEventAndStatuses(
    eventId: string,
    statuses: (typeof orders.$inferSelect.status)[],
  ): Promise<string[]> {
    if (statuses.length === 0) {
      return [];
    }
    const db = getDb();
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.eventId, eventId), inArray(orders.status, statuses)));
    return rows.map((r) => r.id);
  }

  async getByIds(ids: string[]): Promise<(typeof orders.$inferSelect)[]> {
    if (ids.length === 0) {
      return [];
    }
    const db = getDb();
    return db.select().from(orders).where(inArray(orders.id, ids));
  }

  async listByPersonId(personId: string): Promise<(typeof orders.$inferSelect)[]> {
    const db = getDb();
    return db
      .select()
      .from(orders)
      .where(eq(orders.personId, personId))
      .orderBy(desc(orders.createdAt));
  }

}

export const ordersService = new OrdersService();

/** Column refs for admin route filters (orders table only). */
export const orderColumns = {
  id: orders.id,
  personId: orders.personId,
  eventId: orders.eventId,
} as const;
