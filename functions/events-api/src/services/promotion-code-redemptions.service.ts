import { introspectTable } from "@neon/resource-api";
import { eq } from "drizzle-orm";

import { getDb } from "../db/index";
import { promotionCodeRedemptions } from "../db/schema";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";

export { promotionCodeRedemptions as promotionCodeRedemptionsTable };

export const promotionCodeRedemptionsResourceMeta = introspectTable(
  promotionCodeRedemptions,
  {
    fields: {
      list: ["id", "promotionCodeId", "orderId", "createdAt"],
    },
    list: { defaultSort: "-createdAt" },
  },
);

export class PromotionCodeRedemptionsService extends TableService<
  typeof promotionCodeRedemptions
> {
  constructor() {
    super({
      table: promotionCodeRedemptions,
      meta: promotionCodeRedemptionsResourceMeta,
      defaultSort: "-createdAt",
    });
  }

  async insertInTx(
    tx: EntityTx,
    params: { promotionCodeId: string; orderId: string },
  ): Promise<void> {
    await tx
      .insert(promotionCodeRedemptions)
      .values({
        promotionCodeId: params.promotionCodeId,
        orderId: params.orderId,
      })
      .onConflictDoNothing();
  }

  async findByOrderId(
    orderId: string,
    tx?: EntityTx,
  ): Promise<typeof promotionCodeRedemptions.$inferSelect | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select()
      .from(promotionCodeRedemptions)
      .where(eq(promotionCodeRedemptions.orderId, orderId))
      .limit(1);
    return row ?? null;
  }
}

export const promotionCodeRedemptionsService = new PromotionCodeRedemptionsService();
