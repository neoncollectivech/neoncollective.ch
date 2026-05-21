import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { orderTiers } from "../db/schema";
import type { EntityTx } from "./transaction";

export type OrderTierLine = typeof orderTiers.$inferSelect;

export class OrderTiersService {
  async listForOrder(orderId: string, tx?: EntityTx): Promise<OrderTierLine[]> {
    const executor = tx ?? getDb();
    return executor
      .select()
      .from(orderTiers)
      .where(eq(orderTiers.orderId, orderId))
      .orderBy(asc(orderTiers.eventTierId));
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
