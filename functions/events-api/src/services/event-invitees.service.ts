import { defineFilterable, introspectPgTable, type ListQuery, type ListResult } from "@neon/admin-crud";
import { and, eq, isNull, type SQL } from "drizzle-orm";

import { getDb } from "../db/index";
import { eventInvitees, events, people } from "../db/schema";
import { listAdminInviteesForEvent } from "./admin/invitees-read";
import { orClauses } from "./base/sql-utils";
import { TableService } from "./base/table-service";
import type { ServiceContext } from "./base/types";
import { parentSqlFromCtx } from "./base/map-ctx";
import { phoneDigitsLookupVariants } from "../contact";

const inviteesFilterable = defineFilterable([] as const);

export type EventInviteesTx = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

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
    parts.push(eq(people.email, email));
  }
  for (const digits of phoneDigitsVariants(contact)) {
    parts.push(eq(eventInvitees.phone, digits));
    parts.push(eq(people.phone, digits));
  }
  return orClauses(parts);
}

export class EventInviteesService extends TableService<
  typeof eventInvitees,
  typeof eventInvitees.$inferSelect,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, never>,
  unknown
> {
  constructor() {
    super({
      table: eventInvitees,
      meta: introspectPgTable(eventInvitees),
      filterable: inviteesFilterable,
    });
  }

  override async list(
    query: ListQuery<Record<string, never>>,
    ctx?: ServiceContext,
  ): Promise<ListResult<unknown>> {
    const eventId = ctx?.parent?.value ?? ctx?.hono?.req.param("eventId");
    if (eventId) {
      const items = await listAdminInviteesForEvent(eventId);
      return {
        items,
        meta: {
          total: items.length,
          limit: query.limit,
          skip: 0,
          page: 1,
          pageSize: items.length,
        },
      };
    }
    return super.list(query, ctx);
  }

  override async count(
    query: ListQuery<Record<string, never>>,
    ctx?: ServiceContext,
  ): Promise<number> {
    const eventId = ctx?.parent?.value ?? ctx?.hono?.req.param("eventId");
    if (eventId) {
      const items = await listAdminInviteesForEvent(eventId);
      return items.length;
    }
    return super.count(query, ctx);
  }

  protected override async listWhere(ctx?: ServiceContext) {
    return parentSqlFromCtx(ctx);
  }

  /** Active (non-revoked) invitees on an event matching email and/or phone (with digit variants). */
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
    const base = and(eq(eventInvitees.eventId, eventId), isNull(eventInvitees.revokedAt));
    const rows = await executor
      .select({ inv: eventInvitees })
      .from(eventInvitees)
      .leftJoin(people, eq(people.id, eventInvitees.personId))
      .where(and(base, match));
    const seen = new Set<string>();
    const out: (typeof eventInvitees.$inferSelect)[] = [];
    for (const row of rows) {
      if (!seen.has(row.inv.id)) {
        seen.add(row.inv.id);
        out.push(row.inv);
      }
    }
    return out;
  }

  /** First active invitee match (admin upsert dedupe). */
  async findActiveInviteeByContactOnEvent(
    eventId: string,
    contact: InviteeContactLookup,
    tx?: EventInviteesTx,
  ): Promise<typeof eventInvitees.$inferSelect | null> {
    const rows = await this.findActiveInviteesByContactOnEvent(eventId, contact, tx);
    return rows[0] ?? null;
  }

  eventInviteContactMatchForPerson(person: typeof people.$inferSelect): SQL | null {
    const contactMatch: SQL[] = [];
    const email = person.email?.trim().toLowerCase();
    if (email) {
      contactMatch.push(eq(eventInvitees.email, email));
    }
    const storedPhone = person.phone?.trim();
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

  /** Link event invite rows that match this person's contact but lack `person_id`. */
  async syncEventInviteesToPerson(personId: string): Promise<void> {
    const db = getDb();
    const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
    if (!person) {
      return;
    }
    const contactMatch = this.eventInviteContactMatchForPerson(person);
    if (!contactMatch) {
      return;
    }
    await db
      .update(eventInvitees)
      .set({ personId })
      .where(and(isNull(eventInvitees.personId), contactMatch));
  }

  async hasLinkedPublishedInvitee(personId: string): Promise<boolean> {
    const db = getDb();
    const [row] = await db
      .select({ id: eventInvitees.id })
      .from(eventInvitees)
      .innerJoin(events, eq(events.id, eventInvitees.eventId))
      .where(
        and(
          eq(eventInvitees.personId, personId),
          isNull(eventInvitees.revokedAt),
          eq(events.status, "published"),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async hasPublishedEventInviteContactMatch(personId: string): Promise<boolean> {
    const db = getDb();
    const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
    if (!person) {
      return false;
    }
    const contactMatch = this.eventInviteContactMatchForPerson(person);
    if (!contactMatch) {
      return false;
    }
    const [row] = await db
      .select({ id: eventInvitees.id })
      .from(eventInvitees)
      .innerJoin(events, eq(events.id, eventInvitees.eventId))
      .where(
        and(
          contactMatch,
          isNull(eventInvitees.revokedAt),
          eq(events.status, "published"),
        ),
      )
      .limit(1);
    return Boolean(row);
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
}

export const eventInviteesService = new EventInviteesService();
