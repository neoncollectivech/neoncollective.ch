import { ConflictError, introspectTable } from "@neon/resource-api";
import { and, desc, eq } from "drizzle-orm";

import { promotionCodes } from "../db/schema";
import { ordersService } from "./orders.service";
import type { EntityTx } from "./transaction";
import type { ServiceContext } from "./base/types";
import { TableService } from "./base/table-service";

export { promotionCodes as promotionCodesTable };

export const promotionCodesResourceMeta = introspectTable(promotionCodes, {
  fields: {
    list: [
      "id",
      "eventId",
      "code",
      "kind",
      "percentBps",
      "amountOffCents",
      "tierOverrides",
      "maxRedemptions",
      "active",
      "startsAt",
      "endsAt",
      "createdAt",
    ],
    read: [
      "id",
      "eventId",
      "code",
      "kind",
      "percentBps",
      "amountOffCents",
      "tierOverrides",
      "maxRedemptions",
      "active",
      "startsAt",
      "endsAt",
      "createdAt",
    ],
  },
  list: { defaultSort: "-createdAt" },
});

export class PromotionCodesService extends TableService<typeof promotionCodes> {
  constructor() {
    super({
      table: promotionCodes,
      meta: promotionCodesResourceMeta,
      defaultSort: "-createdAt",
    });
  }

  async findByEventAndCodeInTx(
    tx: EntityTx,
    eventId: string,
    normalizedCode: string,
  ): Promise<typeof promotionCodes.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(promotionCodes)
      .where(
        and(eq(promotionCodes.eventId, eventId), eq(promotionCodes.code, normalizedCode)),
      )
      .limit(1);
    return row ?? null;
  }

  async findActiveByEventAndCodeInTx(
    tx: EntityTx,
    eventId: string,
    normalizedCode: string,
  ): Promise<typeof promotionCodes.$inferSelect | null> {
    const now = new Date();
    const [row] = await tx
      .select()
      .from(promotionCodes)
      .where(
        and(eq(promotionCodes.eventId, eventId), eq(promotionCodes.code, normalizedCode)),
      )
      .limit(1);
    if (!row || !row.active) {
      return null;
    }
    if (row.startsAt && row.startsAt > now) {
      return null;
    }
    if (row.endsAt && row.endsAt < now) {
      return null;
    }
    return row;
  }

  async listForEventInTx(
    tx: EntityTx,
    eventId: string,
  ): Promise<(typeof promotionCodes.$inferSelect)[]> {
    return tx
      .select()
      .from(promotionCodes)
      .where(eq(promotionCodes.eventId, eventId))
      .orderBy(desc(promotionCodes.createdAt));
  }

  async createInTx(
    tx: EntityTx,
    values: typeof promotionCodes.$inferInsert,
  ): Promise<typeof promotionCodes.$inferSelect> {
    const [row] = await tx.insert(promotionCodes).values(values).returning();
    return row!;
  }

  async updateInTx(
    tx: EntityTx,
    id: string,
    eventId: string,
    patch: Partial<typeof promotionCodes.$inferInsert>,
  ): Promise<typeof promotionCodes.$inferSelect | null> {
    const [row] = await tx
      .update(promotionCodes)
      .set(patch)
      .where(and(eq(promotionCodes.id, id), eq(promotionCodes.eventId, eventId)))
      .returning();
    return row ?? null;
  }

  async getForEventInTx(
    tx: EntityTx,
    eventId: string,
    promotionCodeId: string,
  ): Promise<typeof promotionCodes.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(promotionCodes)
      .where(
        and(eq(promotionCodes.id, promotionCodeId), eq(promotionCodes.eventId, eventId)),
      )
      .limit(1);
    return row ?? null;
  }

  protected override async beforeDelete(id: string, _ctx?: ServiceContext): Promise<void> {
    const used = await ordersService.countPendingOrPaidForPromotionCode(id);
    if (used > 0) {
      throw new ConflictError(
        "Cannot delete a promotion code that has been used on an order.",
      );
    }
  }
}

export const promotionCodesService = new PromotionCodesService();
