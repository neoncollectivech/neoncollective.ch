import { introspectTable } from "@neon/resource-api";
import { decodeJwt } from "jose";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { admissions, orders, people } from "../db/schema";
import { signAdmissionCredential, verifyAdmissionCredential } from "../helpers/admission-jwt";
import { formatOrderTierNamesFromLines } from "../helpers/order-tier-labels";
import { admissionSigningKeysService } from "./admission-signing-keys.service";
import { eventRegistrationsService } from "./event-registrations.service";
import { eventTiersService } from "./event-tiers.service";
import { orderTiersService } from "./order-tiers.service";
import { ordersService } from "./orders.service";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export type CheckInGuestDisplay = {
  guestName: string;
  tiers: string;
};

export type CheckInByCredentialResult =
  | ({ ok: true } & CheckInGuestDisplay)
  | ({ ok: false; reason: "already_checked_in" } & CheckInGuestDisplay)
  | { ok: false; reason: "admission_not_found" };

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

  async aggregatedTierIdsForPersonOnEventInTx(
    tx: AdmissionTx,
    personId: string,
    eventId: string,
  ): Promise<string[]> {
    return eventRegistrationsService.listTierIdsForPersonOnEventInTx(tx, personId, eventId);
  }

  async findAdmissionForPersonOnEventInTx(
    tx: AdmissionTx,
    personId: string,
    eventId: string,
  ): Promise<typeof admissions.$inferSelect | null> {
    const registration = await eventRegistrationsService.findByPersonOnEventInTx(
      tx,
      personId,
      eventId,
    );
    if (!registration || registration.status !== "confirmed") {
      return null;
    }
    const [admission] = await tx
      .select()
      .from(admissions)
      .where(eq(admissions.registrationId, registration.id))
      .limit(1);
    return admission ?? null;
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
      const registration = await eventRegistrationsService.findByPersonOnEventInTx(
        tx,
        order.personId,
        order.eventId,
      );
      if (!registration || registration.status !== "confirmed") {
        return { ok: false, reason: "canonical_missing" };
      }

      let admission =
        (
          await tx
            .select()
            .from(admissions)
            .where(eq(admissions.registrationId, registration.id))
            .limit(1)
        )[0] ?? null;

      if (!admission) {
        const admissionId = crypto.randomUUID();
        const credential = await signAdmissionCredential({
          admissionId,
          kid: signingKey.kid,
          privateJwk: signingKey.privateJwk,
        });
        let inserted: typeof admissions.$inferSelect | undefined;
        try {
          [inserted] = await tx
            .insert(admissions)
            .values({
              id: admissionId,
              eventId: order.eventId,
              orderId,
              registrationId: registration.id,
              signedCredential: credential,
            })
            .returning();
        } catch (error) {
          if (!isPostgresUniqueViolation(error)) {
            throw error;
          }
        }

        if (!inserted) {
          admission =
            (
              await tx
                .select()
                .from(admissions)
                .where(eq(admissions.registrationId, registration.id))
                .limit(1)
            )[0] ?? null;
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

    const canonical = await this.findAdmissionForPersonOnEventInTx(
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

  async resolveGuestDisplayForAdmission(
    admission: Pick<
      typeof admissions.$inferSelect,
      "orderId" | "eventId" | "registrationId"
    >,
  ): Promise<CheckInGuestDisplay> {
    const db = getDb();
    const [personRow] = await db
      .select({
        givenName: people.givenName,
        familyName: people.familyName,
        personId: orders.personId,
      })
      .from(orders)
      .innerJoin(people, eq(orders.personId, people.id))
      .where(eq(orders.id, admission.orderId))
      .limit(1);

    const guestName = personRow
      ? `${personRow.givenName} ${personRow.familyName}`.trim() || "Guest"
      : "Guest";

    if (!personRow) {
      return { guestName, tiers: "" };
    }

    const registration = await eventRegistrationsService.findByPersonOnEvent(
      personRow.personId,
      admission.eventId,
    );
    const tierIds =
      registration?.status === "confirmed"
        ? await eventRegistrationsService.listTierIdsForRegistration(registration.id)
        : [];
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

    return {
      guestName,
      tiers: formatOrderTierNamesFromLines(lines) ?? "",
    };
  }

  async checkInByCredential(params: {
    credential: string;
    checkedInBy: string;
    restrictToEventId: string | null;
  }): Promise<CheckInByCredentialResult> {
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
      .where(and(eq(admissions.id, admissionId), isNull(admissions.revokedAt)))
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

    const guest = await this.resolveGuestDisplayForAdmission(admission);

    if (admission.checkedInAt) {
      return { ok: false, reason: "already_checked_in", ...guest };
    }

    await db
      .update(admissions)
      .set({
        checkedInAt: new Date(),
        checkedInBy: params.checkedInBy,
      })
      .where(eq(admissions.id, admission.id));

    return { ok: true, ...guest };
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

  async revokeForRegistrationInTx(tx: AdmissionTx, registrationId: string): Promise<void> {
    await tx
      .update(admissions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(admissions.registrationId, registrationId), isNull(admissions.revokedAt)),
      );
  }

  async hasActiveAdmissionForRegistrationInTx(
    tx: AdmissionTx,
    registrationId: string,
  ): Promise<boolean> {
    const [row] = await tx
      .select({ id: admissions.id })
      .from(admissions)
      .where(
        and(eq(admissions.registrationId, registrationId), isNull(admissions.revokedAt)),
      )
      .limit(1);
    return row != null;
  }

  async regenerateAllAdmissionsForEventInTx(
    tx: AdmissionTx,
    eventId: string,
  ): Promise<{ regenerated: number; created: number; skipped: number; failed: number }> {
    let regenerated = 0;
    let created = 0;
    const skipped = 0;
    let failed = 0;

    const registrations = await eventRegistrationsService.listConfirmedForEventInTx(
      tx,
      eventId,
    );

    for (const registration of registrations) {
      const order = await ordersService.getInTx(tx, registration.primaryOrderId);
      if (!order) {
        failed += 1;
        continue;
      }

      const admission =
        (
          await tx
            .select()
            .from(admissions)
            .where(eq(admissions.registrationId, registration.id))
            .limit(1)
        )[0] ?? null;

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

      const issued = await this.issueAdmissionForPaidOrderInTx(
        tx,
        registration.primaryOrderId,
      );
      if (issued.ok) {
        created += 1;
      } else {
        failed += 1;
      }
    }

    return { regenerated, created, skipped, failed };
  }

  async countRegistrationAdmissionsGapInTx(
    tx: AdmissionTx,
    eventId: string,
  ): Promise<{
    confirmedRegistrations: number;
    withAdmission: number;
    eligibleWithoutAdmission: number;
  }> {
    const gap = await eventRegistrationsService.countAdmissionsGapForEventInTx(tx, eventId);
    return {
      confirmedRegistrations: gap.confirmedRegistrations,
      withAdmission: gap.withAdmission,
      eligibleWithoutAdmission: gap.eligibleWithoutAdmission,
    };
  }
}

export const admissionsService = new AdmissionsService();
