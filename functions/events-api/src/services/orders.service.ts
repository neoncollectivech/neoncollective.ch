import {
  buildFilterConditions,
  defineFilterable,
  filterable,
  listMetaFromScope,
  parseListQuery,
  type InferFilterParams,
  type ListQuery,
  type ListResult,
} from "@neon/admin-crud";
import { createLogger } from "@neon/server-kit";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { getDb } from "../db/index";
import { events, orders, people, stripeEventsProcessed } from "../db/schema";
import { AbstractService } from "./base/abstract-service";
import type { ServiceContext } from "./base/types";
import {
  getAdminOrderDetail,
  listOrderTierLines,
  serializeAdminOrderListRow,
} from "./admin/orders-read";

const ordersFilterable = defineFilterable([
  filterable("eventId", orders.eventId),
  filterable("status", orders.status),
] as const);

export type OrdersListFilters = InferFilterParams<typeof ordersFilterable>;

export type OrderListRow = ReturnType<typeof serializeAdminOrderListRow>;

export type OrderTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

const log = createLogger("orders-service");

export class OrdersService extends AbstractService<OrdersListFilters, OrderListRow> {
  /** Returns false when this Stripe event id was already processed. */
  async claimStripeWebhookEventTx(tx: OrderTx, stripeEventId: string): Promise<boolean> {
    const inserted = await tx
      .insert(stripeEventsProcessed)
      .values({ stripeEventId })
      .onConflictDoNothing()
      .returning({ id: stripeEventsProcessed.stripeEventId });
    return inserted.length > 0;
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

  async failOrderFromWebhook(params: {
    orderId: string;
    stripeEventId: string;
  }): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      const claimed = await this.claimStripeWebhookEventTx(tx, params.stripeEventId);
      if (!claimed) {
        log.info({ eventId: params.stripeEventId }, "Duplicate webhook — skipping fail order");
        return;
      }
      const result = await this.failOrderInTx(tx, params.orderId);
      if (result === "not_found") {
        log.warn({ orderId: params.orderId }, "Order not found for fail webhook");
        return;
      }
      if (result === "failed") {
        log.info(
          { orderId: params.orderId, eventId: params.stripeEventId },
          "Order marked failed",
        );
      }
    });
  }

  async get(orderId: string): Promise<typeof orders.$inferSelect | null> {
    const db = getDb();
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return row ?? null;
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

  async deleteDeletableAdminOrder(
    orderId: string,
  ): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const deletable = new Set<typeof orders.$inferSelect.status>(["pending", "failed"]);
    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return { ok: false, status: 404, error: "Order not found." };
    }
    if (!deletable.has(order.status)) {
      return {
        ok: false,
        status: 400,
        error: "Only pending or failed orders can be deleted. Refund paid orders instead.",
      };
    }
    await db.delete(orders).where(eq(orders.id, orderId));
    return { ok: true };
  }

  async getDetail(id: string, _ctx?: ServiceContext) {
    return getAdminOrderDetail(id);
  }

  protected async resolveWhere(
    query: ListQuery<OrdersListFilters>,
  ): Promise<SQL | undefined> {
    const filterConds = buildFilterConditions(
      query.filters as Record<string, string | string[] | undefined>,
      ordersFilterable,
    );
    const conditions: (SQL | undefined)[] = [...filterConds];

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      conditions.push(
        or(
          ilike(people.email, term),
          ilike(people.givenName, term),
          ilike(people.familyName, term),
          ilike(events.title, term),
        ),
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async list(
    query: ListQuery<OrdersListFilters>,
    _ctx?: ServiceContext,
  ): Promise<ListResult<OrderListRow>> {
    const whereClause = await this.resolveWhere(query);
    const db = getDb();
    const rows = await db
      .select({
        order: orders,
        person: people,
        event: { id: events.id, slug: events.slug, title: events.title },
      })
      .from(orders)
      .innerJoin(people, eq(people.id, orders.personId))
      .innerJoin(events, eq(events.id, orders.eventId))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(query.limit)
      .offset(query.skip);

    const items: OrderListRow[] = [];
    for (const row of rows) {
      const tierLines = await listOrderTierLines(row.order.id);
      const tierLabel =
        tierLines.length > 0 ? tierLines.map((t) => t.name).join(" + ") : "—";
      items.push(
        serializeAdminOrderListRow({
          order: row.order,
          person: row.person,
          tierLabel,
          event: row.event,
        }),
      );
    }

    const total = await this.count(query, _ctx);
    return {
      items,
      meta: listMetaFromScope(
        { where: whereClause, orderBy: [], limit: query.limit, skip: query.skip },
        total,
      ),
    };
  }

  async count(query: ListQuery<OrdersListFilters>, _ctx?: ServiceContext): Promise<number> {
    const whereClause = await this.resolveWhere(query);
    const db = getDb();
    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(people, eq(people.id, orders.personId))
      .innerJoin(events, eq(events.id, orders.eventId))
      .where(whereClause);
    return countRow?.total ?? 0;
  }

  parseListQuery(raw: Record<string, string | string[] | undefined>) {
    return parseListQuery<OrdersListFilters>(raw);
  }
}

export const ordersService = new OrdersService();
