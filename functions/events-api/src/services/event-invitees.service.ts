import { defineFilterable, introspectPgTable } from "@neon/admin-crud";
import { and, asc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";

import { normalizeEmailTypo, phoneDigitsLookupVariants } from "../helpers/contact";
import { getDb } from "../db/index";
import { eventInvitees, orders } from "../db/schema";

export { eventInvitees as eventInviteesTable };
import { orClauses } from "./base/sql-utils";
import { TableService } from "./base/table-service";
import type { EntityTx } from "./transaction";

export type EventInviteesTx = EntityTx;

/** Admin CRUD parent column for nested invitee routes. */
export const eventInviteesEventIdColumn = eventInvitees.eventId;

/** Columns allowed for admin invitee list sorting. */
export const eventInviteesAdminSortFields = {
  id: eventInvitees.id,
  personId: eventInvitees.personId,
  email: eventInvitees.email,
  phone: eventInvitees.phone,
  notes: eventInvitees.notes,
  revokedAt: eventInvitees.revokedAt,
  createdAt: eventInvitees.createdAt,
} as const;

export type InviteeContactLookup = {
  email: string | null;
  phoneDigits?: string | null;
  phoneE164?: string | null;
};

function phoneDigitsVariants(contact: InviteeContactLookup): string[] {
  if (contact.phoneE164?.trim()) {
    return phoneDigitsLookupVariants(contact.phoneE164.trim());
  }
  const digits = contact.phoneDigits?.trim();
  if (!digits) {
    return [];
  }
  const variants = phoneDigitsLookupVariants(`+${digits}`);
  return variants.length > 0 ? variants : [digits];
}

function contactMatchSql(contact: InviteeContactLookup): SQL | null {
  const parts: SQL[] = [];
  const email = contact.email?.trim().toLowerCase() ?? null;
  if (email) {
    parts.push(eq(eventInvitees.email, email));
  }
  for (const digits of phoneDigitsVariants(contact)) {
    parts.push(eq(eventInvitees.phone, digits));
  }
  return orClauses(parts);
}

const inviteesFilterable = defineFilterable([] as const);

export const INVITEE_ORDER_STATUS_FILTERS = [
  "empty",
  "has",
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;

export type InviteeOrderStatusFilter =
  (typeof INVITEE_ORDER_STATUS_FILTERS)[number];

export function parseInviteeOrderStatusFilter(
  raw: string | string[] | undefined,
): InviteeOrderStatusFilter | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "none" || normalized === "false" || normalized === "0") {
    return "empty";
  }
  if (normalized === "true" || normalized === "1") {
    return "has";
  }

  return INVITEE_ORDER_STATUS_FILTERS.includes(
    normalized as InviteeOrderStatusFilter,
  )
    ? (normalized as InviteeOrderStatusFilter)
    : undefined;
}

export function buildInviteeOrderStatusWhere(
  eventId: string,
  filter: InviteeOrderStatusFilter,
): SQL {
  if (filter === "empty") {
    return sql`(
      ${eventInvitees.personId} IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM ${orders} o
        WHERE o.event_id = ${eventId}::uuid
          AND o.person_id = ${eventInvitees.personId}
      )
    )`;
  }

  if (filter === "has") {
    return sql`(
      ${eventInvitees.personId} IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM ${orders} o
        WHERE o.event_id = ${eventId}::uuid
          AND o.person_id = ${eventInvitees.personId}
      )
    )`;
  }

  return sql`(
    ${eventInvitees.personId} IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM (
        SELECT DISTINCT ON (o.person_id) o.person_id, o.status
        FROM ${orders} o
        WHERE o.event_id = ${eventId}::uuid
        ORDER BY o.person_id, o.created_at DESC
      ) latest
      WHERE latest.person_id = ${eventInvitees.personId}
        AND latest.status = ${filter}
    )
  )`;
}

export class EventInviteesService extends TableService<
  typeof eventInvitees,
  typeof eventInvitees.$inferSelect,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, never>
> {
  constructor() {
    super({
      table: eventInvitees,
      meta: introspectPgTable(eventInvitees),
      filterable: inviteesFilterable,
    });
  }

  listDefaultSort(): string {
    return "-createdAt";
  }

  contactMatchFromPersonFields(fields: {
    email: string | null;
    phone: string | null;
  }): SQL | null {
    const contactMatch: SQL[] = [];
    const email = fields.email?.trim().toLowerCase();
    if (email) {
      contactMatch.push(eq(eventInvitees.email, email));
    }
    const storedPhone = fields.phone?.trim();
    if (storedPhone) {
      contactMatch.push(eq(eventInvitees.phone, storedPhone));
      for (const variant of phoneDigitsLookupVariants(`+${storedPhone}`)) {
        if (variant === storedPhone) {
          continue;
        }
        contactMatch.push(eq(eventInvitees.phone, variant));
      }
    }
    return orClauses(contactMatch);
  }

  async findActiveInviteesByContactOnEvent(
    eventId: string,
    contact: InviteeContactLookup,
    tx?: EventInviteesTx,
  ): Promise<(typeof eventInvitees.$inferSelect)[]> {
    const match = contactMatchSql(contact);
    if (!match) {
      return [];
    }
    const executor = tx ?? getDb();
    return executor
      .select()
      .from(eventInvitees)
      .where(and(eq(eventInvitees.eventId, eventId), isNull(eventInvitees.revokedAt), match));
  }

  async findActiveInviteeByContactOnEvent(
    eventId: string,
    contact: InviteeContactLookup,
    tx?: EventInviteesTx,
  ): Promise<typeof eventInvitees.$inferSelect | null> {
    const rows = await this.findActiveInviteesByContactOnEvent(eventId, contact, tx);
    return rows[0] ?? null;
  }

  async syncEventInviteesToPerson(
    personId: string,
    fields: { email: string | null; phone: string | null },
  ): Promise<void> {
    const contactMatch = this.contactMatchFromPersonFields(fields);
    if (!contactMatch) {
      return;
    }
    const db = getDb();
    await db
      .update(eventInvitees)
      .set({ personId })
      .where(and(isNull(eventInvitees.personId), contactMatch));
  }

  async findLinkedPersonIdByEmail(email: string): Promise<string | undefined> {
    const em = normalizeEmailTypo(email.trim()).toLowerCase();
    const db = getDb();
    const [invitee] = await db
      .select({ personId: eventInvitees.personId })
      .from(eventInvitees)
      .where(and(eq(eventInvitees.email, em), isNotNull(eventInvitees.personId)))
      .limit(1);
    return invitee?.personId ?? undefined;
  }

  async findLinkedPersonIdByPhoneE164(phoneE164: string): Promise<string | undefined> {
    const variants = phoneDigitsLookupVariants(phoneE164);
    if (variants.length === 0) {
      return undefined;
    }
    const inviteePhoneMatch = orClauses(variants.map((d) => eq(eventInvitees.phone, d)));
    if (!inviteePhoneMatch) {
      return undefined;
    }
    const db = getDb();
    const [invitee] = await db
      .select({ personId: eventInvitees.personId })
      .from(eventInvitees)
      .where(and(isNotNull(eventInvitees.personId), inviteePhoneMatch))
      .limit(1);
    return invitee?.personId ?? undefined;
  }

  async findOrphanInviteeIdByContact(
    contact: { kind: "email"; email: string } | { kind: "phone"; e164: string },
  ): Promise<string | undefined> {
    const db = getDb();
    if (contact.kind === "email") {
      const em = normalizeEmailTypo(contact.email.trim()).toLowerCase();
      const [row] = await db
        .select({ id: eventInvitees.id })
        .from(eventInvitees)
        .where(
          and(
            isNull(eventInvitees.personId),
            isNull(eventInvitees.revokedAt),
            eq(eventInvitees.email, em),
          ),
        )
        .limit(1);
      return row?.id;
    }
    const variants = phoneDigitsLookupVariants(contact.e164);
    if (variants.length === 0) {
      return undefined;
    }
    const phoneMatch = orClauses(variants.map((d) => eq(eventInvitees.phone, d)));
    if (!phoneMatch) {
      return undefined;
    }
    const [row] = await db
      .select({ id: eventInvitees.id })
      .from(eventInvitees)
      .where(
        and(isNull(eventInvitees.personId), isNull(eventInvitees.revokedAt), phoneMatch),
      )
      .limit(1);
    return row?.id;
  }

  async hasActiveInviteeForPersonOnEventInTx(
    tx: EventInviteesTx,
    eventId: string,
    personId: string,
  ): Promise<boolean> {
    const [row] = await tx
      .select({ id: eventInvitees.id })
      .from(eventInvitees)
      .where(
        and(
          eq(eventInvitees.eventId, eventId),
          eq(eventInvitees.personId, personId),
          isNull(eventInvitees.revokedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async findByPersonIdOnEvent(
    eventId: string,
    personId: string,
  ): Promise<typeof eventInvitees.$inferSelect | null | "ambiguous"> {
    const db = getDb();
    const base = and(eq(eventInvitees.eventId, eventId), isNull(eventInvitees.revokedAt));
    const rows = await db
      .select()
      .from(eventInvitees)
      .where(and(base, eq(eventInvitees.personId, personId)));
    if (rows.length === 0) {
      return null;
    }
    if (rows.length > 1) {
      return "ambiguous";
    }
    return rows[0]!;
  }

  async findFirstDegreeHostOnEvent(
    eventId: string,
    personId: string,
  ): Promise<typeof eventInvitees.$inferSelect | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(eventInvitees)
      .where(
        and(
          eq(eventInvitees.eventId, eventId),
          eq(eventInvitees.personId, personId),
          isNull(eventInvitees.inviterId),
          isNull(eventInvitees.revokedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findFirstDegreeHostOnEventInTx(
    tx: EventInviteesTx,
    eventId: string,
    personId: string,
  ): Promise<typeof eventInvitees.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(eventInvitees)
      .where(
        and(
          eq(eventInvitees.eventId, eventId),
          eq(eventInvitees.personId, personId),
          isNull(eventInvitees.inviterId),
          isNull(eventInvitees.revokedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createGuestFromCheckoutInTx(
    tx: EventInviteesTx,
    params: {
      eventId: string;
      personId: string;
      inviterId: string;
      email: string | null;
      phone: string | null;
    },
  ): Promise<string> {
    const [inserted] = await tx
      .insert(eventInvitees)
      .values({
        eventId: params.eventId,
        personId: params.personId,
        inviterId: params.inviterId,
        email: params.email,
        phone: params.phone,
      })
      .returning({ id: eventInvitees.id });
    return inserted!.id;
  }

  async listActiveByEventId(eventId: string): Promise<(typeof eventInvitees.$inferSelect)[]> {
    const db = getDb();
    return db
      .select()
      .from(eventInvitees)
      .where(and(eq(eventInvitees.eventId, eventId), isNull(eventInvitees.revokedAt)));
  }

  async listByEventId(eventId: string): Promise<(typeof eventInvitees.$inferSelect)[]> {
    const db = getDb();
    return db
      .select()
      .from(eventInvitees)
      .where(eq(eventInvitees.eventId, eventId))
      .orderBy(asc(eventInvitees.createdAt));
  }

  async listByPersonId(personId: string): Promise<(typeof eventInvitees.$inferSelect)[]> {
    const db = getDb();
    return db.select().from(eventInvitees).where(eq(eventInvitees.personId, personId));
  }

  async listActiveEventIdsForPerson(personId: string): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .select({ eventId: eventInvitees.eventId })
      .from(eventInvitees)
      .where(
        and(
          eq(eventInvitees.personId, personId),
          isNull(eventInvitees.revokedAt),
        ),
      );
    return [...new Set(rows.map((r) => r.eventId))];
  }

  async listActiveEventIdsByContact(fields: {
    email: string | null;
    phone: string | null;
  }): Promise<string[]> {
    const contactMatch = this.contactMatchFromPersonFields(fields);
    if (!contactMatch) {
      return [];
    }
    const db = getDb();
    const rows = await db
      .select({ eventId: eventInvitees.eventId })
      .from(eventInvitees)
      .where(and(contactMatch, isNull(eventInvitees.revokedAt)));
    return [...new Set(rows.map((r) => r.eventId))];
  }

  async hasActiveInviteeMatchingContactOnAnyEvent(fields: {
    email: string | null;
    phone: string | null;
  }): Promise<boolean> {
    const contactMatch = this.contactMatchFromPersonFields(fields);
    if (!contactMatch) {
      return false;
    }
    const db = getDb();
    const [row] = await db
      .select({ id: eventInvitees.id })
      .from(eventInvitees)
      .where(and(contactMatch, isNull(eventInvitees.revokedAt)))
      .limit(1);
    return Boolean(row);
  }

  async getInTx(
    tx: EventInviteesTx,
    inviteeId: string,
  ): Promise<typeof eventInvitees.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(eventInvitees)
      .where(eq(eventInvitees.id, inviteeId))
      .limit(1);
    return row ?? null;
  }

  async getActiveOnEventInTx(
    tx: EventInviteesTx,
    eventId: string,
    inviteeId: string,
  ): Promise<typeof eventInvitees.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(eventInvitees)
      .where(
        and(
          eq(eventInvitees.id, inviteeId),
          eq(eventInvitees.eventId, eventId),
          isNull(eventInvitees.revokedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createAdminInviteeInTx(
    tx: EventInviteesTx,
    params: {
      eventId: string;
      email: string | null;
      phone: string | null;
      notes: string | null;
    },
  ): Promise<string> {
    const [row] = await tx
      .insert(eventInvitees)
      .values({
        eventId: params.eventId,
        personId: null,
        inviterId: null,
        email: params.email,
        phone: params.phone,
        notes: params.notes ?? undefined,
      })
      .returning({ id: eventInvitees.id });
    return row!.id;
  }

  async setPersonIdInTx(
    tx: EventInviteesTx,
    inviteeId: string,
    personId: string,
  ): Promise<void> {
    await tx
      .update(eventInvitees)
      .set({ personId })
      .where(eq(eventInvitees.id, inviteeId));
  }

  async revokeInTx(eventId: string, inviteeId: string): Promise<boolean> {
    const db = getDb();
    const res = await db
      .update(eventInvitees)
      .set({ revokedAt: new Date() })
      .where(and(eq(eventInvitees.id, inviteeId), eq(eventInvitees.eventId, eventId)))
      .returning({ id: eventInvitees.id });
    return res.length > 0;
  }
}

export const eventInviteesService = new EventInviteesService();
