import { randomHex } from "@neon/server-kit";

import { introspectTable } from "@neon/resource-api";
import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { admissions } from "../db/schema";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";

export { admissions as admissionsTable };

export const admissionsResourceMeta = introspectTable(admissions, {
  fields: {
    list: [
      "id",
      "orderId",
      "eventId",
      "checkedInAt",
      "revokedAt",
      "createdAt",
    ],
  },
});

export type AdmissionTx = EntityTx;

function randomAdmissionToken(): string {
  return randomHex(16);
}

export class AdmissionsService extends TableService<typeof admissions> {
  constructor() {
    super({
      table: admissions,
      meta: admissionsResourceMeta,
    });
  }

  async checkInByToken(params: {
    token: string;
    staffLabel: string;
  }): Promise<{ ok: true } | { ok: false; reason: "admission_not_found" }> {
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
      return { ok: false, reason: "admission_not_found" };
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

  async createForPaidOrderInTx(
    tx: AdmissionTx,
    params: { orderId: string; eventId: string; eventTierId: string },
  ): Promise<void> {
    await tx
      .insert(admissions)
      .values({
        publicToken: randomAdmissionToken(),
        eventId: params.eventId,
        eventTierId: params.eventTierId,
        orderId: params.orderId,
      })
      .onConflictDoNothing({ target: admissions.orderId });
  }

  async revokeForOrderInTx(tx: AdmissionTx, orderId: string): Promise<void> {
    await tx
      .update(admissions)
      .set({ revokedAt: new Date() })
      .where(and(eq(admissions.orderId, orderId), isNull(admissions.revokedAt)));
  }

  async findIdByOrderInTx(
    tx: AdmissionTx,
    orderId: string,
  ): Promise<string | null> {
    const [row] = await tx
      .select({ id: admissions.id })
      .from(admissions)
      .where(eq(admissions.orderId, orderId))
      .limit(1);
    return row?.id ?? null;
  }

  async countByEventTierId(tierId: string, tx?: AdmissionTx): Promise<number> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ qty: sql<number>`count(*)::int` })
      .from(admissions)
      .where(eq(admissions.eventTierId, tierId));
    return Number(row?.qty ?? 0);
  }

  async findByOrderId(
    orderId: string,
    tx?: AdmissionTx,
  ): Promise<typeof admissions.$inferSelect | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select()
      .from(admissions)
      .where(eq(admissions.orderId, orderId))
      .limit(1);
    return row ?? null;
  }
}

export const admissionsService = new AdmissionsService();
