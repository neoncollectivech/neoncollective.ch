import { randomHex } from "@neon/server-kit";

import { introspectTable } from "@neon/resource-api";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { admissions, eventTiers, orders, people } from "../db/schema";
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

export type PublicAdmissionsListScope = {
  limit: number;
  skip: number;
  checkedIn?: boolean;
};

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
    checkedInBy: string;
    restrictToEventId: string | null;
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
    if (
      params.restrictToEventId !== null &&
      row.eventId !== params.restrictToEventId
    ) {
      return { ok: false, reason: "admission_not_found" };
    }
    await db
      .update(admissions)
      .set({
        checkedInAt: new Date(),
        checkedInBy: params.checkedInBy,
      })
      .where(eq(admissions.id, row.id));
    return { ok: true };
  }

  async listPublicForEvent(
    eventId: string,
    scope: PublicAdmissionsListScope,
  ): Promise<{
    admissions: {
      id: string;
      publicToken: string;
      givenName: string;
      familyName: string;
      tierName: string;
      checkedInAt: string | null;
      revokedAt: string | null;
    }[];
    meta: { total: number; limit: number; skip: number };
  }> {
    const db = getDb();
    const filters = [
      eq(admissions.eventId, eventId),
      isNull(admissions.revokedAt),
      eq(orders.status, "paid"),
    ];
    if (scope.checkedIn === true) {
      filters.push(isNotNull(admissions.checkedInAt));
    } else if (scope.checkedIn === false) {
      filters.push(isNull(admissions.checkedInAt));
    }
    const whereClause = and(...filters);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(admissions)
      .innerJoin(orders, eq(admissions.orderId, orders.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: admissions.id,
        publicToken: admissions.publicToken,
        givenName: people.givenName,
        familyName: people.familyName,
        tierName: eventTiers.name,
        checkedInAt: admissions.checkedInAt,
        revokedAt: admissions.revokedAt,
      })
      .from(admissions)
      .innerJoin(orders, eq(admissions.orderId, orders.id))
      .innerJoin(people, eq(orders.personId, people.id))
      .innerJoin(eventTiers, eq(admissions.eventTierId, eventTiers.id))
      .where(whereClause)
      .orderBy(desc(admissions.createdAt))
      .limit(scope.limit)
      .offset(scope.skip);

    return {
      admissions: rows.map((row) => ({
        id: row.id,
        publicToken: row.publicToken,
        givenName: row.givenName,
        familyName: row.familyName,
        tierName: row.tierName,
        checkedInAt: row.checkedInAt?.toISOString() ?? null,
        revokedAt: row.revokedAt?.toISOString() ?? null,
      })),
      meta: {
        total: Number(countRow?.total ?? 0),
        limit: scope.limit,
        skip: scope.skip,
      },
    };
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
