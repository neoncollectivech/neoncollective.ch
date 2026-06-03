import { introspectTable } from "@neon/resource-api";
import { decodeJwt } from "jose";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { admissions, orders, people } from "../db/schema";
import { signAdmissionCredential, verifyAdmissionCredential } from "../helpers/admission-jwt";
import { formatOrderTierNamesFromLines } from "../helpers/order-tier-labels";
import { admissionSigningKeysService } from "./admission-signing-keys.service";
import { eventTiersService } from "./event-tiers.service";
import { orderTiersService } from "./order-tiers.service";
import { ordersService } from "./orders.service";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";

const admissionsTableMeta = introspectTable(admissions, {
  fields: { list: [], read: [], create: [], update: [] },
});

export type AdmissionTx = EntityTx;

export type PublicAdmissionsListScope = {
  limit: number;
  skip: number;
  checkedIn?: boolean;
};

export type IssueAdmissionResult =
  | { ok: true }
  | {
      ok: false;
      reason: "order_not_found" | "no_tiers" | "signing_key_missing" | "canonical_missing";
    };

export class AdmissionsService extends TableService<typeof admissions> {
  constructor() {
    super({
      table: admissions,
      meta: admissionsTableMeta,
    });
  }

  async listPaidOrderIdsForPersonOnEventInTx(
    tx: AdmissionTx,
    personId: string,
    eventId: string,
  ): Promise<string[]> {
    return ordersService.listIdsForPersonOnEventAndStatusesInTx(tx, {
      eventId,
      personId,
      statuses: ["paid"],
    });
  }

  async aggregatedTierIdsForPersonOnEventInTx(
    tx: AdmissionTx,
    personId: string,
    eventId: string,
  ): Promise<string[]> {
    const paidOrderIds = await this.listPaidOrderIdsForPersonOnEventInTx(tx, personId, eventId);

    return orderTiersService.listEventTierIdsForPaidPersonOnEventInTx(tx, {
      personId,
      eventId,
    }, paidOrderIds);
  }

  async findCanonicalAdmissionForPersonOnEventInTx(
    tx: AdmissionTx,
    personId: string,
    eventId: string,
  ): Promise<typeof admissions.$inferSelect | null> {
    const personOrders = await ordersService.listPendingOrPaidForPersonOnEventInTx(
      tx,
      eventId,
      personId,
    );

    for (const order of personOrders) {
      if (order.status !== "paid") {
        continue;
      }
      const tierIds = await orderTiersService.getEventTierIdsForOrder(order.id, tx);
      const exclusiveTierId = await eventTiersService.findExclusiveTierIdAmong(tierIds, tx);
      if (!exclusiveTierId) {
        continue;
      }
      const admission = await this.findByOrderId(order.id, tx);
      if (admission) {
        return admission;
      }
    }

    return null;
  }

  async orderHasExclusiveTierInTx(tx: AdmissionTx, orderId: string): Promise<boolean> {
    const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId, tx);

    return Boolean(await eventTiersService.findExclusiveTierIdAmong(tierIds, tx));
  }

  async refreshSignedCredentialInTx(
    tx: AdmissionTx,
    admission: typeof admissions.$inferSelect,
    personId: string,
  ): Promise<boolean> {
    const signingKey = await admissionSigningKeysService.getForEvent(admission.eventId, tx);
    if (!signingKey) {
      return false;
    }

    const tierIds = await this.aggregatedTierIdsForPersonOnEventInTx(
      tx,
      personId,
      admission.eventId,
    );
    if (tierIds.length === 0) {
      return false;
    }

    const credential = await signAdmissionCredential({
      admissionId: admission.id,
      kid: signingKey.kid,
      privateJwk: signingKey.privateJwk,
    });

    await tx
      .update(admissions)
      .set({ signedCredential: credential })
      .where(eq(admissions.id, admission.id));

    return true;
  }

  async issueAdmissionForPaidOrderInTx(
    tx: AdmissionTx,
    orderId: string,
  ): Promise<IssueAdmissionResult> {
    const order = await ordersService.getInTx(tx, orderId);
    if (!order) {
      return { ok: false, reason: "order_not_found" };
    }

    const tierIds = await this.aggregatedTierIdsForPersonOnEventInTx(
      tx,
      order.personId,
      order.eventId,
    );
    if (tierIds.length === 0) {
      return { ok: false, reason: "no_tiers" };
    }

    const signingKey = await admissionSigningKeysService.getForEvent(order.eventId, tx);
    if (!signingKey) {
      return { ok: false, reason: "signing_key_missing" };
    }

    const hasExclusive = await this.orderHasExclusiveTierInTx(tx, orderId);

    if (hasExclusive) {
      let admission = await this.findByOrderId(orderId, tx);
      if (!admission) {
        const admissionId = crypto.randomUUID();
        const credential = await signAdmissionCredential({
          admissionId,
          kid: signingKey.kid,
          privateJwk: signingKey.privateJwk,
        });
        const [inserted] = await tx
          .insert(admissions)
          .values({
            id: admissionId,
            eventId: order.eventId,
            orderId,
            signedCredential: credential,
          })
          .onConflictDoNothing({ target: admissions.orderId })
          .returning();

        if (!inserted) {
          admission = await this.findByOrderId(orderId, tx);
          if (!admission) {
            return { ok: false, reason: "no_tiers" };
          }
          const refreshed = await this.refreshSignedCredentialInTx(tx, admission, order.personId);
          if (!refreshed) {
            return { ok: false, reason: "signing_key_missing" };
          }
        }

        return { ok: true };
      }

      const refreshed = await this.refreshSignedCredentialInTx(tx, admission, order.personId);
      if (!refreshed) {
        return { ok: false, reason: "signing_key_missing" };
      }

      return { ok: true };
    }

    const canonical = await this.findCanonicalAdmissionForPersonOnEventInTx(
      tx,
      order.personId,
      order.eventId,
    );
    if (!canonical) {
      return { ok: false, reason: "canonical_missing" };
    }

    const refreshed = await this.refreshSignedCredentialInTx(tx, canonical, order.personId);
    if (!refreshed) {
      return { ok: false, reason: "signing_key_missing" };
    }

    return { ok: true };
  }

  async checkInByCredential(params: {
    credential: string;
    checkedInBy: string;
    restrictToEventId: string | null;
  }): Promise<{ ok: true } | { ok: false; reason: "admission_not_found" }> {
    const trimmed = params.credential.trim();
    if (!trimmed) {
      return { ok: false, reason: "admission_not_found" };
    }

    let admissionId: string;
    try {
      const payload = decodeJwt(trimmed);
      admissionId = typeof payload.sub === "string" ? payload.sub : "";
    } catch {
      return { ok: false, reason: "admission_not_found" };
    }

    if (!admissionId) {
      return { ok: false, reason: "admission_not_found" };
    }

    const db = getDb();
    const [admission] = await db
      .select()
      .from(admissions)
      .where(
        and(
          eq(admissions.id, admissionId),
          isNull(admissions.revokedAt),
          isNull(admissions.checkedInAt),
        ),
      )
      .limit(1);

    if (!admission) {
      return { ok: false, reason: "admission_not_found" };
    }

    if (
      params.restrictToEventId !== null &&
      admission.eventId !== params.restrictToEventId
    ) {
      return { ok: false, reason: "admission_not_found" };
    }

    const signingKey = await admissionSigningKeysService.getForEvent(admission.eventId);
    if (!signingKey) {
      return { ok: false, reason: "admission_not_found" };
    }

    const verified = await verifyAdmissionCredential({
      credential: trimmed,
      kid: signingKey.kid,
      publicJwk: signingKey.publicJwk,
    });

    if (!verified || verified.admissionId !== admission.id) {
      return { ok: false, reason: "admission_not_found" };
    }

    await db
      .update(admissions)
      .set({
        checkedInAt: new Date(),
        checkedInBy: params.checkedInBy,
      })
      .where(eq(admissions.id, admission.id));

    return { ok: true };
  }

  async cancelCheckIn(
    admissionId: string,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: "not_found" | "not_checked_in" | "revoked" }
  > {
    const db = getDb();
    const [admission] = await db
      .select({
        id: admissions.id,
        checkedInAt: admissions.checkedInAt,
        revokedAt: admissions.revokedAt,
      })
      .from(admissions)
      .where(eq(admissions.id, admissionId))
      .limit(1);

    if (!admission) {
      return { ok: false, reason: "not_found" };
    }

    if (admission.revokedAt) {
      return { ok: false, reason: "revoked" };
    }

    if (!admission.checkedInAt) {
      return { ok: false, reason: "not_checked_in" };
    }

    await db
      .update(admissions)
      .set({ checkedInAt: null, checkedInBy: null })
      .where(eq(admissions.id, admissionId));

    return { ok: true };
  }

  async listPublicForEvent(
    eventId: string,
    scope: PublicAdmissionsListScope,
  ): Promise<{
    admissions: {
      id: string;
      credential: string;
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
        credential: admissions.signedCredential,
        givenName: people.givenName,
        familyName: people.familyName,
        personId: orders.personId,
        orderId: admissions.orderId,
        checkedInAt: admissions.checkedInAt,
        revokedAt: admissions.revokedAt,
      })
      .from(admissions)
      .innerJoin(orders, eq(admissions.orderId, orders.id))
      .innerJoin(people, eq(orders.personId, people.id))
      .where(whereClause)
      .orderBy(desc(admissions.createdAt))
      .limit(scope.limit)
      .offset(scope.skip);

    const admissionsOut: {
      id: string;
      credential: string;
      givenName: string;
      familyName: string;
      tierName: string;
      checkedInAt: string | null;
      revokedAt: string | null;
    }[] = [];

    for (const row of rows) {
      const paidOrderIds = await ordersService.listIdsForPersonOnEventAndStatuses({
        eventId,
        personId: row.personId,
        statuses: ["paid"],
      });
      const tierIds = await orderTiersService.listTierIdsAmongOrderIds(paidOrderIds);
      const tiers = await eventTiersService.getByIds(tierIds);
      const lines = tierIds.map((eventTierId) => {
        const tier = tiers.find((t) => t.id === eventTierId);
        return {
          id: eventTierId,
          name: tier?.name ?? eventTierId,
          selectionMode: tier?.selectionMode ?? ("addon" as const),
          unitPriceCents: 0,
        };
      });
      const tierName = formatOrderTierNamesFromLines(lines) ?? "";

      admissionsOut.push({
        id: row.id,
        credential: row.credential,
        givenName: row.givenName,
        familyName: row.familyName,
        tierName,
        checkedInAt: row.checkedInAt?.toISOString() ?? null,
        revokedAt: row.revokedAt?.toISOString() ?? null,
      });
    }

    return {
      admissions: admissionsOut,
      meta: {
        total: Number(countRow?.total ?? 0),
        limit: scope.limit,
        skip: scope.skip,
      },
    };
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

  async regenerateAllAdmissionsForEventInTx(
    tx: AdmissionTx,
    eventId: string,
  ): Promise<{ regenerated: number; created: number; skipped: number; failed: number }> {
    let regenerated = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    const paidOrderIds = await ordersService.listPaidOrderIdsForEventInTx(tx, eventId);

    for (const orderId of paidOrderIds) {
      const order = await ordersService.getInTx(tx, orderId);
      if (!order) {
        failed += 1;
        continue;
      }

      const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId, tx);
      const hasExclusive = Boolean(
        await eventTiersService.findExclusiveTierIdAmong(tierIds, tx),
      );
      if (!hasExclusive) {
        skipped += 1;
        continue;
      }

      const admission = await this.findByOrderId(orderId, tx);
      if (admission) {
        const refreshed = await this.refreshSignedCredentialInTx(
          tx,
          admission,
          order.personId,
        );
        if (refreshed) {
          regenerated += 1;
        } else {
          failed += 1;
        }
        continue;
      }

      const issued = await this.issueAdmissionForPaidOrderInTx(tx, orderId);
      if (issued.ok) {
        created += 1;
      } else {
        failed += 1;
      }
    }

    return { regenerated, created, skipped, failed };
  }

  async countPaidExclusiveOrdersWithoutAdmissionInTx(
    tx: AdmissionTx,
    eventId: string,
  ): Promise<{ paidExclusiveOrders: number; withAdmission: number; eligibleWithoutAdmission: number }> {
    const paidOrders = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid")));

    let paidExclusiveOrders = 0;
    let withAdmission = 0;

    for (const { id: orderId } of paidOrders) {
      const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId, tx);
      const hasExclusive = Boolean(
        await eventTiersService.findExclusiveTierIdAmong(tierIds, tx),
      );
      if (!hasExclusive) {
        continue;
      }
      paidExclusiveOrders += 1;
      const admissionId = await this.findIdByOrderInTx(tx, orderId);
      if (admissionId) {
        withAdmission += 1;
      }
    }

    return {
      paidExclusiveOrders,
      withAdmission,
      eligibleWithoutAdmission: paidExclusiveOrders - withAdmission,
    };
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
