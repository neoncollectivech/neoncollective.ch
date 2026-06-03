import { introspectTable } from "@neon/resource-api";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { orderTiers } from "../db/schema";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";

export { orderTiers as orderTiersTable };

export const orderTiersResourceMeta = introspectTable(orderTiers, {
  fields: {
    list: ["id", "orderId", "eventTierId", "unitPriceCents"],
  },
  list: { defaultSort: "eventTierId" },
});

export type OrderTierLine = typeof orderTiers.$inferSelect;

export class OrderTiersService extends TableService<typeof orderTiers> {
  constructor() {
    super({
      table: orderTiers,
      meta: orderTiersResourceMeta,
      defaultSort: "eventTierId",
    });
  }

  async listForOrder(orderId: string, tx?: EntityTx): Promise<OrderTierLine[]> {
    const executor = tx ?? getDb();
    return executor
      .select()
      .from(orderTiers)
      .where(eq(orderTiers.orderId, orderId))
      .orderBy(asc(orderTiers.eventTierId));
  }

  async listForOrders(orderIds: string[], tx?: EntityTx): Promise<OrderTierLine[]> {
    if (orderIds.length === 0) {
      return [];
    }
    const executor = tx ?? getDb();
    return executor
      .select()
      .from(orderTiers)
      .where(inArray(orderTiers.orderId, orderIds))
      .orderBy(asc(orderTiers.orderId), asc(orderTiers.eventTierId));
  }

  async getEventTierIdsForOrder(orderId: string, tx?: EntityTx): Promise<string[]> {
    const lines = await this.listForOrder(orderId, tx);
    return lines.map((l) => l.eventTierId);
  }

  async replaceForOrderInTx(
    tx: EntityTx,
    orderId: string,
    lines: { eventTierId: string; unitPriceCents: number }[],
  ): Promise<void> {
    await tx.delete(orderTiers).where(eq(orderTiers.orderId, orderId));
    if (lines.length === 0) {
      return;
    }
    await tx.insert(orderTiers).values(
      lines.map((line) => ({
        orderId,
        eventTierId: line.eventTierId,
        unitPriceCents: line.unitPriceCents,
      })),
    );
  }

  async insertLinesInTx(
    tx: EntityTx,
    lines: { orderId: string; eventTierId: string; unitPriceCents: number }[],
  ): Promise<void> {
    if (lines.length === 0) {
      return;
    }
    await tx.insert(orderTiers).values(lines);
  }

  async countByTierAmongOrderIds(tierId: string, orderIds: string[], tx?: EntityTx): Promise<number> {
    if (orderIds.length === 0) {
      return 0;
    }
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ qty: sql<number>`count(*)::int` })
      .from(orderTiers)
      .where(and(eq(orderTiers.eventTierId, tierId), inArray(orderTiers.orderId, orderIds)));
    return Number(row?.qty ?? 0);
  }

  async countByTierIdsAmongOrderIds(
    tierIds: string[],
    orderIds: string[],
    tx?: EntityTx,
  ): Promise<number> {
    if (tierIds.length === 0 || orderIds.length === 0) {
      return 0;
    }
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ qty: sql<number>`count(*)::int` })
      .from(orderTiers)
      .where(
        and(
          inArray(orderTiers.eventTierId, tierIds),
          inArray(orderTiers.orderId, orderIds),
        ),
      );
    return Number(row?.qty ?? 0);
  }

  async listTierIdsAmongOrderIds(orderIds: string[], tx?: EntityTx): Promise<string[]> {
    if (orderIds.length === 0) {
      return [];
    }
    const executor = tx ?? getDb();
    const rows = await executor
      .select({ eventTierId: orderTiers.eventTierId })
      .from(orderTiers)
      .where(inArray(orderTiers.orderId, orderIds));
    return rows.map((r) => r.eventTierId);
  }

  /** Unique sorted `eventTierId` values across all paid orders for a person on an event. */
  async listEventTierIdsForPaidPersonOnEventInTx(
    tx: EntityTx,
    params: { personId: string; eventId: string },
    paidOrderIds: string[],
  ): Promise<string[]> {
    const tierIds = await this.listTierIdsAmongOrderIds(paidOrderIds, tx);

    return [...new Set(tierIds)].sort();
  }

  async hasAnyTierAmongOrderIds(
    orderIds: string[],
    tierIds: string[],
    tx?: EntityTx,
  ): Promise<boolean> {
    if (orderIds.length === 0 || tierIds.length === 0) {
      return false;
    }
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ id: orderTiers.id })
      .from(orderTiers)
      .where(
        and(
          inArray(orderTiers.orderId, orderIds),
          inArray(orderTiers.eventTierId, tierIds),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async countByEventTierId(tierId: string, tx?: EntityTx): Promise<number> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ qty: sql<number>`count(*)::int` })
      .from(orderTiers)
      .where(eq(orderTiers.eventTierId, tierId));
    return Number(row?.qty ?? 0);
  }

  async pendingOrderTierIdsMatch(
    orderId: string,
    eventTierIds: string[],
    tx?: EntityTx,
  ): Promise<boolean> {
    const lines = await this.listForOrder(orderId, tx);
    if (lines.length !== eventTierIds.length) {
      return false;
    }
    const orderTierIds = new Set(lines.map((line) => line.eventTierId));
    for (const tierId of eventTierIds) {
      if (!orderTierIds.has(tierId)) {
        return false;
      }
    }
    return true;
  }
}

export const orderTiersService = new OrderTiersService();
