import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { getDb } from "../db/index";
import { participantSessions } from "../db/schema";
import { countRowsWhere, purgeIdTableInBatches } from "./base/purge-batches";
import type { EntityTx } from "./transaction";

export type ParticipantSessionRow = typeof participantSessions.$inferSelect;

export class ParticipantSessionsService {
  async insertInTx(
    tx: EntityTx,
    values: {
      tokenHash: string;
      personId: string | null;
      inviteLinkId?: string | null;
      expiresAt: Date;
    },
  ): Promise<string> {
    const [session] = await tx
      .insert(participantSessions)
      .values({
        tokenHash: values.tokenHash,
        personId: values.personId,
        inviteLinkId: values.inviteLinkId ?? null,
        expiresAt: values.expiresAt,
      })
      .returning({ id: participantSessions.id });
    return session!.id;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<{
    sessionId: string;
    personId: string | null;
    inviteLinkId: string | null;
  } | null> {
    const db = getDb();
    const [row] = await db
      .select({
        sessionId: participantSessions.id,
        personId: participantSessions.personId,
        inviteLinkId: participantSessions.inviteLinkId,
      })
      .from(participantSessions)
      .where(
        and(
          eq(participantSessions.tokenHash, tokenHash),
          isNull(participantSessions.revokedAt),
          gt(participantSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async updatePersonIdInTx(
    tx: EntityTx,
    sessionId: string,
    personId: string,
  ): Promise<void> {
    await tx
      .update(participantSessions)
      .set({ personId })
      .where(eq(participantSessions.id, sessionId));
  }

  async updateInviteLinkIdInTx(
    tx: EntityTx,
    sessionId: string,
    inviteLinkId: string | null,
  ): Promise<void> {
    await tx
      .update(participantSessions)
      .set({ inviteLinkId })
      .where(eq(participantSessions.id, sessionId));
  }

  async deleteByIdInTx(tx: EntityTx, sessionId: string): Promise<void> {
    await tx.delete(participantSessions).where(eq(participantSessions.id, sessionId));
  }

  async deleteById(sessionId: string): Promise<void> {
    const db = getDb();
    await db.delete(participantSessions).where(eq(participantSessions.id, sessionId));
  }

  async updateTokenHashAndExpiryInTx(
    tx: EntityTx,
    sessionId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await tx
      .update(participantSessions)
      .set({ tokenHash, expiresAt })
      .where(eq(participantSessions.id, sessionId));
  }

  private maintenanceWhere(): SQL {
    return lt(participantSessions.expiresAt, new Date());
  }

  async countMaintenanceEligible(): Promise<number> {
    return countRowsWhere(participantSessions, this.maintenanceWhere());
  }

  async purgeMaintenanceEligible(): Promise<number> {
    return purgeIdTableInBatches(
      participantSessions,
      participantSessions.id,
      this.maintenanceWhere(),
    );
  }
}

export const participantSessionsService = new ParticipantSessionsService();
