import { defineFilterable, introspectPgTable, parseListQuery, type ListQuery } from "@neon/admin-crud";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import {
  normalizeEmailTypo,
  normalizeOptionalPhoneE164,
  phoneDigitsLookupVariants,
  phoneToStoredDigits,
} from "../contact";
import {
  isEmailVerified,
  isPhoneVerified,
  personHasEmailField,
  personHasPhoneField,
  type PersonRow,
} from "../profile";
import { getDb } from "../db/index";
import { eventInvitees, people } from "../db/schema";
import { eventInviteesService } from "./event-invitees.service";
import { ordersService } from "./orders.service";
import { getAdminPersonDetail } from "./admin/people-read";
import {
  prepareAdminPersonUpdate,
  type AdminPersonUpdateInput,
} from "./admin/update-person";
import { orClauses } from "./base/sql-utils";
import { TableService } from "./base/table-service";
import type { ServiceContext } from "./base/types";

const peopleFilterable = defineFilterable([] as const);

const peopleMeta = introspectPgTable(people, {
  exclude: {
    update: ["phone", "emailVerifiedAt", "phoneVerifiedAt", "updatedAt"],
  },
  fields: {
    list: [
      "id",
      "givenName",
      "familyName",
      "email",
      "phone",
      "emailVerifiedAt",
      "phoneVerifiedAt",
      "createdAt",
    ],
  },
  list: {
    searchFields: [
      people.email,
      people.givenName,
      people.familyName,
      people.phone,
    ],
  },
});

export type PeopleTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export class IdentityConflictError extends Error {
  constructor() {
    super("identity_conflict");
    this.name = "IdentityConflictError";
  }
}

export type ProfileContactFields = {
  email: string | null;
  phoneDigits: string | null;
  phoneE164: string | null;
};

export function normalizeStoredEmail(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  return normalizeEmailTypo(raw.trim()).toLowerCase();
}

export function toPersonRow(row: typeof people.$inferSelect | null | undefined): PersonRow | null {
  if (!row) {
    return null;
  }
  return {
    givenName: row.givenName,
    familyName: row.familyName,
    email: row.email,
    phone: row.phone,
    emailVerifiedAt: row.emailVerifiedAt,
    phoneVerifiedAt: row.phoneVerifiedAt,
  };
}

export function profileContactFieldsMatch(
  existing: PersonRow,
  params: ProfileContactFields & { givenName: string; familyName: string },
): boolean {
  return (
    existing.givenName === params.givenName &&
    existing.familyName === params.familyName &&
    normalizeStoredEmail(existing.email) === params.email &&
    (existing.phone ?? null) === params.phoneDigits
  );
}

export class PeopleService extends TableService<
  typeof people,
  typeof people.$inferSelect,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, never>
> {
  constructor() {
    super({
      table: people,
      meta: peopleMeta,
      filterable: peopleFilterable,
      defaultSort: "-createdAt",
    });
  }

  parseListQuery(raw: Record<string, string | string[] | undefined>): ListQuery<Record<string, never>> {
    return parseListQuery(raw);
  }

  async getDetail(id: string, _ctx?: ServiceContext) {
    return getAdminPersonDetail(id);
  }

  protected override async beforeUpdate(
    id: string,
    data: Record<string, unknown>,
    _ctx?: ServiceContext,
  ): Promise<Record<string, unknown>> {
    return prepareAdminPersonUpdate(id, data as AdminPersonUpdateInput);
  }

  /** Profile row for participant flows (subset of table columns). */
  async getProfileRow(id: string): Promise<PersonRow | null> {
    return toPersonRow(await this.get(id));
  }

  async getInTx(tx: PeopleTx, id: string): Promise<typeof people.$inferSelect | null> {
    const [row] = await tx.select().from(people).where(eq(people.id, id)).limit(1);
    return row ?? null;
  }

  async getProfileRowInTx(tx: PeopleTx, id: string): Promise<PersonRow | null> {
    return toPersonRow(await this.getInTx(tx, id));
  }

  parseProfileContactInput(params: {
    email: string | null;
    phoneE164: string | null;
  }): ProfileContactFields | { error: string } {
    const em = params.email?.trim()
      ? normalizeEmailTypo(params.email.trim()).toLowerCase()
      : null;
    let phoneDigits: string | null = null;
    let phoneE164: string | null = null;
    if (params.phoneE164?.trim()) {
      const e164 = normalizeOptionalPhoneE164(params.phoneE164);
      if (!e164) {
        return { error: "Invalid phone number." };
      }
      phoneE164 = e164;
      phoneDigits = phoneToStoredDigits(e164);
      if (!phoneDigits) {
        return { error: "Invalid phone number." };
      }
    }
    if (!em && !phoneDigits) {
      return { error: "Provide at least an email address or a phone number." };
    }
    return { email: em, phoneDigits, phoneE164 };
  }

  async applyVerificationResetInTx(
    tx: PeopleTx,
    personId: string,
    params: {
      emailChanged: boolean;
      phoneChanged: boolean;
      previousEmailVerifiedAt: Date | null;
      previousPhoneVerifiedAt: Date | null;
    },
  ): Promise<void> {
    const now = new Date();
    await tx
      .update(people)
      .set({
        emailVerifiedAt: params.emailChanged ? null : params.previousEmailVerifiedAt,
        phoneVerifiedAt: params.phoneChanged ? null : params.previousPhoneVerifiedAt,
        updatedAt: now,
      })
      .where(eq(people.id, personId));
  }

  /** Admin: mark present email/phone channels as verified (no OTP). */
  async verifyPeopleBulk(personIds: string[]): Promise<{
    updated: number;
    skipped: number;
    notFound: number;
  }> {
    const uniqueIds = [...new Set(personIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { updated: 0, skipped: 0, notFound: 0 };
    }

    const db = getDb();
    const now = new Date();
    const rows = await db.select().from(people).where(inArray(people.id, uniqueIds));

    let updated = 0;
    let skipped = 0;

    for (const person of rows) {
      if (!personHasEmailField(person) && !personHasPhoneField(person)) {
        skipped++;
        continue;
      }

      const patch: {
        emailVerifiedAt?: Date;
        phoneVerifiedAt?: Date;
        updatedAt: Date;
      } = { updatedAt: now };
      let changed = false;

      if (personHasEmailField(person) && !isEmailVerified(person)) {
        patch.emailVerifiedAt = now;
        changed = true;
      }
      if (personHasPhoneField(person) && !isPhoneVerified(person)) {
        patch.phoneVerifiedAt = now;
        changed = true;
      }

      if (!changed) {
        skipped++;
        continue;
      }

      await db.update(people).set(patch).where(eq(people.id, person.id));
      updated++;
    }

    const foundIds = new Set(rows.map((r) => r.id));
    const notFound = uniqueIds.filter((id) => !foundIds.has(id)).length;

    return { updated, skipped, notFound };
  }

  async markContactVerifiedInTx(
    tx: PeopleTx,
    personId: string,
    channel: "email" | "phone",
  ): Promise<PersonRow | null> {
    const now = new Date();
    if (channel === "email") {
      await tx
        .update(people)
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where(eq(people.id, personId));
    } else {
      await tx
        .update(people)
        .set({ phoneVerifiedAt: now, updatedAt: now })
        .where(eq(people.id, personId));
    }
    return this.getProfileRowInTx(tx, personId);
  }

  /** Resolve or create a `people` row; fills missing phone/email when safe; errors on conflicting identities. */
  async ensurePersonInTx(
    tx: PeopleTx,
    params: {
      givenName: string;
      familyName: string;
      email: string | null;
      /** E.164 including +, or null */
      phoneE164: string | null;
    },
  ): Promise<string> {
    const em = params.email?.trim()
      ? normalizeEmailTypo(params.email!.trim()).toLowerCase()
      : null;
    const phoneDigits = phoneToStoredDigits(params.phoneE164);
    if (!em && !phoneDigits) {
      throw new Error("ensurePersonInTx: email or phone required");
    }

    const [byEmail] = em
      ? await tx.select().from(people).where(eq(people.email, em)).limit(1)
      : [undefined];
    const [byPhone] = phoneDigits
      ? await tx.select().from(people).where(eq(people.phone, phoneDigits)).limit(1)
      : [undefined];

    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      throw new IdentityConflictError();
    }

    const existing = byEmail ?? byPhone;
    if (!existing) {
      const [ins] = await tx
        .insert(people)
        .values({
          givenName: params.givenName,
          familyName: params.familyName,
          email: em,
          phone: phoneDigits,
        })
        .returning({ id: people.id });
      return ins!.id;
    }

    const nextEmail = em ?? existing.email ?? null;
    const nextPhone = phoneDigits ?? existing.phone ?? null;
    if (!nextEmail && !nextPhone) {
      throw new Error("ensurePersonInTx: lost contact fields");
    }

    let gn = existing.givenName;
    let fn = existing.familyName;
    if (
      params.givenName &&
      (gn === "Guest" || gn === "Customer" || gn.length === 0) &&
      params.givenName !== "Guest"
    ) {
      gn = params.givenName;
    }
    if (
      params.familyName &&
      (fn === "" || fn === "Customer") &&
      params.familyName.length > 0
    ) {
      fn = params.familyName;
    }

    const now = new Date();
    await tx
      .update(people)
      .set({
        givenName: gn,
        familyName: fn,
        email: nextEmail,
        phone: nextPhone,
        updatedAt: now,
      })
      .where(eq(people.id, existing.id));
    return existing.id;
  }

  /** Link event invite rows that match this person's contact but lack `person_id`. */
  async syncEventInviteesToPerson(personId: string): Promise<void> {
    return eventInviteesService.syncEventInviteesToPerson(personId);
  }

  async personHasRegistrationEligibility(personId: string): Promise<boolean> {
    if (await ordersService.hasOrderForPerson(personId)) {
      return true;
    }
    if (await eventInviteesService.hasLinkedPublishedInvitee(personId)) {
      return true;
    }
    if (await eventInviteesService.hasPublishedEventInviteContactMatch(personId)) {
      return true;
    }
    return false;
  }

  /** Resolve person for registration sign-in (email or E.164 phone). */
  async resolvePersonIdForRegistrationContact(
    contact: { kind: "email"; email: string } | { kind: "phone"; e164: string },
  ): Promise<string | undefined> {
    if (contact.kind === "email") {
      return this.findPersonIdByEmail(contact.email);
    }
    return this.findPersonIdByPhoneE164(contact.e164);
  }

  async findPersonIdByEmail(email: string): Promise<string | undefined> {
    const db = getDb();
    const em = normalizeEmailTypo(email.trim()).toLowerCase();

    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.email, em))
      .limit(1);
    if (person) {
      return person.id;
    }

    const [invitee] = await db
      .select({ personId: eventInvitees.personId })
      .from(eventInvitees)
      .where(and(eq(eventInvitees.email, em), isNotNull(eventInvitees.personId)))
      .limit(1);
    return invitee?.personId ?? undefined;
  }

  async findPersonIdByPhoneE164(phoneE164: string): Promise<string | undefined> {
    const variants = phoneDigitsLookupVariants(phoneE164);
    if (variants.length === 0) {
      return undefined;
    }

    const phoneMatch = orClauses(variants.map((d) => eq(people.phone, d)));
    if (!phoneMatch) {
      return undefined;
    }

    const db = getDb();
    const [person] = await db.select({ id: people.id }).from(people).where(phoneMatch).limit(1);
    if (person) {
      return person.id;
    }

    const inviteePhoneMatch = orClauses(variants.map((d) => eq(eventInvitees.phone, d)));
    if (!inviteePhoneMatch) {
      return undefined;
    }

    const [invitee] = await db
      .select({ personId: eventInvitees.personId })
      .from(eventInvitees)
      .where(and(isNotNull(eventInvitees.personId), inviteePhoneMatch))
      .limit(1);
    return invitee?.personId ?? undefined;
  }

  /** Attach a phone to an email-only person; no-op if phone already set to same; 409 if phone belongs to another row. */
  async attachPhoneToPerson(params: {
    personId: string;
    phoneE164: string;
  }): Promise<{ ok: true } | { ok: false; code: "conflict" | "not_found" }> {
    const db = getDb();
    const digits = phoneToStoredDigits(params.phoneE164);
    if (!digits) {
      return { ok: false, code: "not_found" };
    }

    const [self] = await db.select().from(people).where(eq(people.id, params.personId)).limit(1);
    if (!self) {
      return { ok: false, code: "not_found" };
    }
    if (self.phone === digits) {
      return { ok: true };
    }

    const [other] = await db.select().from(people).where(eq(people.phone, digits)).limit(1);
    if (other && other.id !== self.id) {
      return { ok: false, code: "conflict" };
    }

    await db
      .update(people)
      .set({ phone: digits, updatedAt: new Date() })
      .where(eq(people.id, params.personId));
    return { ok: true };
  }
}

export const peopleService = new PeopleService();
