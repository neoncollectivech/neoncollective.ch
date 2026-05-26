import { and, eq, gt, isNull, isNotNull, lt, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { MAINTENANCE_USED_CODE_RETENTION_DAYS } from "../config/maintenance";
import { getDb } from "../db/index";
import { profileVerificationCodes } from "../db/schema";
import { countRowsWhere, purgeIdTableInBatches } from "./base/purge-batches";
import type { EntityTx } from "./transaction";

export type ProfileVerificationRow = typeof profileVerificationCodes.$inferSelect;

export class ProfileVerificationCodesService {
  async insertInTx(
    tx: EntityTx,
    values: {
      sessionId: string;
      codeHash: string;
      channel: "email" | "phone";
      contactHash: string;
      expiresAt: Date;
    },
  ): Promise<void> {
    await tx.insert(profileVerificationCodes).values(values);
  }

  async insert(params: {
    sessionId: string;
    codeHash: string;
    channel: "email" | "phone";
    contactHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const db = getDb();
    await db.insert(profileVerificationCodes).values(params);
  }

  async deleteByCodeHash(codeHash: string): Promise<void> {
    const db = getDb();
    await db
      .delete(profileVerificationCodes)
      .where(eq(profileVerificationCodes.codeHash, codeHash));
  }

  async deleteByCodeHashForE2e(
    codeHash: string,
    opts?: { profileSessionId?: string },
  ): Promise<void> {
    const db = getDb();
    if (opts?.profileSessionId) {
      await db
        .delete(profileVerificationCodes)
        .where(
          and(
            eq(profileVerificationCodes.codeHash, codeHash),
            eq(profileVerificationCodes.sessionId, opts.profileSessionId),
          ),
        );
    } else {
      await db
        .delete(profileVerificationCodes)
        .where(eq(profileVerificationCodes.codeHash, codeHash));
    }
  }

  async findValid(
    codeHash: string,
    sessionId?: string,
    tx?: EntityTx,
  ): Promise<ProfileVerificationRow | null> {
    const executor = tx ?? getDb();
    const conditions = [
      eq(profileVerificationCodes.codeHash, codeHash),
      isNull(profileVerificationCodes.usedAt),
      gt(profileVerificationCodes.expiresAt, new Date()),
    ];
    if (sessionId) {
      conditions.push(eq(profileVerificationCodes.sessionId, sessionId));
    }
    const [row] = await executor
      .select()
      .from(profileVerificationCodes)
      .where(and(...conditions))
      .limit(1);
    return row ?? null;
  }

  async markUsedInTx(tx: EntityTx, id: string): Promise<void> {
    await tx
      .update(profileVerificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(profileVerificationCodes.id, id));
  }

  private maintenanceWhere(): SQL {
    const usedCutoff = new Date(
      Date.now() - MAINTENANCE_USED_CODE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    return or(
      lt(profileVerificationCodes.expiresAt, new Date()),
      and(
        isNotNull(profileVerificationCodes.usedAt),
        lt(profileVerificationCodes.usedAt, usedCutoff),
      ),
    )!;
  }

  async countMaintenanceEligible(): Promise<number> {
    return countRowsWhere(profileVerificationCodes, this.maintenanceWhere());
  }

  async purgeMaintenanceEligible(): Promise<number> {
    return purgeIdTableInBatches(
      profileVerificationCodes,
      profileVerificationCodes.id,
      this.maintenanceWhere(),
    );
  }
}

export const profileVerificationCodesService = new ProfileVerificationCodesService();
