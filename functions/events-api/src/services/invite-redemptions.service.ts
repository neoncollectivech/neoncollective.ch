import { introspectTable } from "@neon/resource-api";
import { desc, eq } from "drizzle-orm";

import { getDb } from "../db/index";
import { inviteRedemptions } from "../db/schema";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";

export { inviteRedemptions as inviteRedemptionsTable };

export const inviteRedemptionsResourceMeta = introspectTable(inviteRedemptions, {
  fields: {
    list: ["id", "orderId", "inviteLinkId", "createdAt"],
  },
  list: { defaultSort: "-createdAt" },
});

export class InviteRedemptionsService extends TableService<typeof inviteRedemptions> {
  constructor() {
    super({
      table: inviteRedemptions,
      meta: inviteRedemptionsResourceMeta,
      defaultSort: "-createdAt",
    });
  }

  async insertInTx(
    tx: EntityTx,
    params: { inviteLinkId: string; orderId: string },
  ): Promise<void> {
    await tx
      .insert(inviteRedemptions)
      .values({
        inviteLinkId: params.inviteLinkId,
        orderId: params.orderId,
      })
      .onConflictDoNothing();
  }

  async deleteForOrderInTx(tx: EntityTx, orderId: string): Promise<void> {
    await tx.delete(inviteRedemptions).where(eq(inviteRedemptions.orderId, orderId));
  }

  async countForInviteLink(inviteLinkId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ id: inviteRedemptions.id })
      .from(inviteRedemptions)
      .where(eq(inviteRedemptions.inviteLinkId, inviteLinkId));
    return rows.length;
  }

  async listOrderIdsForInviteLink(inviteLinkId: string): Promise<string[]> {
    const rows = await this.listRowsForInviteLink(inviteLinkId);
    return rows.map((r) => r.orderId);
  }

  async listRowsForInviteLink(
    inviteLinkId: string,
  ): Promise<{ orderId: string; createdAt: Date }[]> {
    const db = getDb();
    return db
      .select({ orderId: inviteRedemptions.orderId, createdAt: inviteRedemptions.createdAt })
      .from(inviteRedemptions)
      .where(eq(inviteRedemptions.inviteLinkId, inviteLinkId))
      .orderBy(desc(inviteRedemptions.createdAt));
  }

  async findByOrderId(orderId: string, tx?: EntityTx): Promise<typeof inviteRedemptions.$inferSelect | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select()
      .from(inviteRedemptions)
      .where(eq(inviteRedemptions.orderId, orderId))
      .limit(1);
    return row ?? null;
  }
}

export const inviteRedemptionsService = new InviteRedemptionsService();
