import { and, eq, gt, isNull, isNotNull, lt, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { MAINTENANCE_USED_CODE_RETENTION_DAYS } from "../config/maintenance";
import { getDb } from "../db/index";
import { registrationExchangeCodes } from "../db/schema";
import { countRowsWhere, purgeIdTableInBatches } from "./base/purge-batches";
import type { EntityTx } from "./transaction";

export type RegistrationExchangeRow = typeof registrationExchangeCodes.$inferSelect;

export class RegistrationExchangeCodesService {
  async insert(params: {
    codeHash: string;
    personId: string;
    channel: "email" | "phone";
    expiresAt: Date;
  }): Promise<void> {
    const db = getDb();
    await db.insert(registrationExchangeCodes).values({
      codeHash: params.codeHash,
      personId: params.personId,
      channel: params.channel,
      expiresAt: params.expiresAt,
    });
  }

  async deleteByCodeHash(codeHash: string): Promise<void> {
    const db = getDb();
    await db
      .delete(registrationExchangeCodes)
      .where(eq(registrationExchangeCodes.codeHash, codeHash));
  }

  async findValidByCodeHash(
    codeHash: string,
    tx?: EntityTx,
  ): Promise<RegistrationExchangeRow | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select()
      .from(registrationExchangeCodes)
      .where(
        and(
          eq(registrationExchangeCodes.codeHash, codeHash),
          isNull(registrationExchangeCodes.usedAt),
          gt(registrationExchangeCodes.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async markUsedInTx(tx: EntityTx, id: string): Promise<void> {
    await tx
      .update(registrationExchangeCodes)
      .set({ usedAt: new Date() })
      .where(eq(registrationExchangeCodes.id, id));
  }

  private maintenanceWhere(): SQL {
    const usedCutoff = new Date(
      Date.now() - MAINTENANCE_USED_CODE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    return or(
      lt(registrationExchangeCodes.expiresAt, new Date()),
      and(
        isNotNull(registrationExchangeCodes.usedAt),
        lt(registrationExchangeCodes.usedAt, usedCutoff),
      ),
    )!;
  }

  async countMaintenanceEligible(): Promise<number> {
    return countRowsWhere(registrationExchangeCodes, this.maintenanceWhere());
  }

  async purgeMaintenanceEligible(): Promise<number> {
    return purgeIdTableInBatches(
      registrationExchangeCodes,
      registrationExchangeCodes.id,
      this.maintenanceWhere(),
    );
  }
}

export const registrationExchangeCodesService = new RegistrationExchangeCodesService();
