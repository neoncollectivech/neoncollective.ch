import { introspectTable } from "@neon/resource-api";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { admissions, eventRegistrations, orders } from "../db/schema";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";
import { eventTiersService } from "./event-tiers.service";
import { orderTiersService } from "./order-tiers.service";
import { ordersService } from "./orders.service";

export { eventRegistrations as eventRegistrationsTable };

export type RegistrationTx = EntityTx;

export type EventRegistrationRow = typeof eventRegistrations.$inferSelect;

export const eventRegistrationsResourceMeta = introspectTable(eventRegistrations, {
  fields: {
    list: [
      "id",
      "eventId",
      "personId",
      "status",
      "exclusiveTierId",
      "primaryOrderId",
      "confirmedAt",
      "createdAt",
    ],
    read: [
      "id",
      "eventId",
      "personId",
      "status",
      "exclusiveTierId",
      "primaryOrderId",
      "confirmedAt",
      "createdAt",
      "updatedAt",
    ],
  },
  list: { defaultSort: "-confirmedAt" },
});

export class EventRegistrationsService extends TableService<
  typeof eventRegistrations,
  EventRegistrationRow
> {
  constructor() {
    super({
      table: eventRegistrations,
      meta: eventRegistrationsResourceMeta,
      defaultSort: "-confirmedAt",
    });
  }

  async findByPersonOnEventInTx(
    tx: RegistrationTx,
    personId: string,
    eventId: string,
  ): Promise<EventRegistrationRow | null> {
    const [row] = await tx
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.personId, personId),
          eq(eventRegistrations.eventId, eventId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByPersonOnEvent(
    personId: string,
    eventId: string,
    tx?: RegistrationTx,
  ): Promise<EventRegistrationRow | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.personId, personId),
          eq(eventRegistrations.eventId, eventId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async hasConfirmedRegistrationInTx(
    tx: RegistrationTx,
    personId: string,
    eventId: string,
  ): Promise<boolean> {
    const row = await this.findByPersonOnEventInTx(tx, personId, eventId);
    return row?.status === "confirmed";
  }

  async countConfirmedForEventInTx(tx: RegistrationTx, eventId: string): Promise<number> {
    const [row] = await tx
      .select({ qty: sql<number>`count(*)::int` })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.status, "confirmed"),
        ),
      );
    return Number(row?.qty ?? 0);
  }

  async listConfirmedForEventInTx(
    tx: RegistrationTx,
    eventId: string,
  ): Promise<EventRegistrationRow[]> {
    return tx
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.status, "confirmed"),
        ),
      );
  }

  async listPaidOrderIdsForRegistrationInTx(
    tx: RegistrationTx,
    registrationId: string,
  ): Promise<string[]> {
    return this.listPaidOrderIdsForRegistration(registrationId, tx);
  }

  async listPaidOrderIdsForRegistration(
    registrationId: string,
    tx?: RegistrationTx,
  ): Promise<string[]> {
    const executor = tx ?? getDb();
    const rows = await executor
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.registrationId, registrationId), eq(orders.status, "paid")),
      );
    return rows.map((row) => row.id);
  }

  async listTierIdsForRegistrationInTx(
    tx: RegistrationTx,
    registrationId: string,
  ): Promise<string[]> {
    return this.listTierIdsForRegistration(registrationId, tx);
  }

  async listTierIdsForRegistration(
    registrationId: string,
    tx?: RegistrationTx,
  ): Promise<string[]> {
    const orderIds = await this.listPaidOrderIdsForRegistration(registrationId, tx);
    if (orderIds.length === 0) {
      return [];
    }
    const tierIds = await orderTiersService.listTierIdsAmongOrderIds(orderIds, tx);
    return [...new Set(tierIds)].sort();
  }

  async listTierIdsForPersonOnEventInTx(
    tx: RegistrationTx,
    personId: string,
    eventId: string,
  ): Promise<string[]> {
    const registration = await this.findByPersonOnEventInTx(tx, personId, eventId);
    if (!registration || registration.status !== "confirmed") {
      return [];
    }
    return this.listTierIdsForRegistrationInTx(tx, registration.id);
  }

  async confirmFromPaidExclusiveOrderInTx(
    tx: RegistrationTx,
    order: typeof orders.$inferSelect,
    exclusiveTierId: string,
  ): Promise<EventRegistrationRow> {
    const existing = await this.findByPersonOnEventInTx(tx, order.personId, order.eventId);
    if (existing) {
      if (existing.primaryOrderId === order.id && existing.status === "refunded") {
        const [updated] = await tx
          .update(eventRegistrations)
          .set({
            status: "confirmed",
            exclusiveTierId,
            confirmedAt: order.checkoutFulfilledAt ?? order.updatedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(eventRegistrations.id, existing.id))
          .returning();
        const registration = updated ?? existing;
        await this.linkPaidOrdersForRegistrationInTx(tx, registration);
        return registration;
      }

      await tx
        .update(orders)
        .set({
          registrationId: existing.id,
          orderKind: order.id === existing.primaryOrderId ? "registration" : "upsell",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      await this.linkPaidOrdersForRegistrationInTx(tx, existing);
      return existing;
    }

    const confirmedAt = order.checkoutFulfilledAt ?? order.updatedAt ?? new Date();
    const [inserted] = await tx
      .insert(eventRegistrations)
      .values({
        eventId: order.eventId,
        personId: order.personId,
        status: "confirmed",
        exclusiveTierId,
        primaryOrderId: order.id,
        confirmedAt,
      })
      .onConflictDoNothing()
      .returning();

    const registration =
      inserted ?? (await this.findByPersonOnEventInTx(tx, order.personId, order.eventId));
    if (!registration) {
      throw new Error("Failed to create event registration.");
    }

    await this.linkPaidOrdersForRegistrationInTx(tx, registration);
    return registration;
  }

  async attachUpsellOrderInTx(
    tx: RegistrationTx,
    order: typeof orders.$inferSelect,
    registrationId: string,
  ): Promise<void> {
    await tx
      .update(orders)
      .set({
        registrationId,
        orderKind: "upsell",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
  }

  async syncForPaidOrderInTx(
    tx: RegistrationTx,
    order: typeof orders.$inferSelect,
  ): Promise<{ ok: true } | { ok: false; reason: "registration_missing" }> {
    const tierIds = await orderTiersService.getEventTierIdsForOrder(order.id, tx);
    const exclusiveTierId = await eventTiersService.findExclusiveTierIdAmong(tierIds, tx);

    if (exclusiveTierId) {
      await this.confirmFromPaidExclusiveOrderInTx(tx, order, exclusiveTierId);
      return { ok: true };
    }

    const registration = await this.findByPersonOnEventInTx(tx, order.personId, order.eventId);
    if (!registration || registration.status !== "confirmed") {
      return { ok: false, reason: "registration_missing" };
    }

    await this.attachUpsellOrderInTx(tx, order, registration.id);
    return { ok: true };
  }

  async linkPaidOrdersForRegistrationInTx(
    tx: RegistrationTx,
    registration: EventRegistrationRow,
  ): Promise<void> {
    const paidOrderIds = await ordersService.listPaidOrderIdsForPersonOnEvent(
      registration.eventId,
      registration.personId,
      tx,
    );

    for (const orderId of paidOrderIds) {
      const tierIds = await orderTiersService.getEventTierIdsForOrder(orderId, tx);
      const hasExclusive = Boolean(
        await eventTiersService.findExclusiveTierIdAmong(tierIds, tx),
      );
      const orderKind =
        orderId === registration.primaryOrderId && hasExclusive
          ? "registration"
          : "upsell";

      await tx
        .update(orders)
        .set({
          registrationId: registration.id,
          orderKind,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }
  }

  async markRefundedInTx(tx: RegistrationTx, registrationId: string): Promise<void> {
    await tx
      .update(eventRegistrations)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(eventRegistrations.id, registrationId));
  }

  async findByPrimaryOrderIdInTx(
    tx: RegistrationTx,
    orderId: string,
  ): Promise<EventRegistrationRow | null> {
    const [row] = await tx
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.primaryOrderId, orderId))
      .limit(1);
    return row ?? null;
  }

  async countAdmissionsGapForEventInTx(
    tx: RegistrationTx,
    eventId: string,
  ): Promise<{
    confirmedRegistrations: number;
    withAdmission: number;
    eligibleWithoutAdmission: number;
  }> {
    const confirmed = await this.countConfirmedForEventInTx(tx, eventId);
    const [admissionRow] = await tx
      .select({ qty: sql<number>`count(*)::int` })
      .from(admissions)
      .innerJoin(
        eventRegistrations,
        eq(admissions.registrationId, eventRegistrations.id),
      )
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.status, "confirmed"),
          sql`${admissions.revokedAt} IS NULL`,
        ),
      );
    const withAdmission = Number(admissionRow?.qty ?? 0);
    return {
      confirmedRegistrations: confirmed,
      withAdmission,
      eligibleWithoutAdmission: Math.max(0, confirmed - withAdmission),
    };
  }
}

export const eventRegistrationsService = new EventRegistrationsService();
