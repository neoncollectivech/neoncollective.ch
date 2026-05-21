import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  defineFilterable,
  introspectPgTable,
  parseListQuery,
  type ListQuery,
} from "@neon/admin-crud";
import { and, eq, ilike, inArray, ne, or } from "drizzle-orm";

import {
  normalizeEmailTypo,
  normalizeOptionalPhoneE164,
  phoneDigitsLookupVariants,
  phoneToStoredDigits,
} from "../helpers/contact";
import {
  isEmailVerified,
  isPhoneVerified,
  personHasEmailField,
  personHasPhoneField,
  toPersonRow,
  type PersonRow,
} from "../helpers/profile";

export type { PersonRow };
export {
  toPersonRow,
  normalizeStoredEmail,
  profileContactFieldsMatch,
} from "../helpers/profile";
import { getDb } from "../db/index";
import { people } from "../db/schema";

export { people as peopleTable };
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

import type { EntityTx } from "./transaction";

export type PeopleTx = EntityTx;

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

export type AdminPersonUpdateInput = {
  givenName?: string;
  familyName?: string;
  email?: string | null;
  phoneE164?: string | null;
};

function normalizeAdminEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  return normalizeEmailTypo(trimmed).toLowerCase();
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

  protected override async beforeUpdate(
    personId: string,
    patch: Record<string, unknown>,
    _ctx?: ServiceContext,
  ): Promise<Record<string, unknown>> {
    const data = patch as AdminPersonUpdateInput;
    const db = getDb();
    const [existing] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Person not found.");
    }

    const givenName =
      data.givenName !== undefined ? data.givenName.trim() : existing.givenName;
    const familyName =
      data.familyName !== undefined ? data.familyName.trim() : existing.familyName;

    if (!givenName || !familyName) {
      throw new BadRequestError("Given name and family name are required.");
    }

    const email =
      data.email !== undefined ? normalizeAdminEmail(data.email) : existing.email;

    let phone = existing.phone;
    if (data.phoneE164 !== undefined) {
      const raw = data.phoneE164?.trim() ?? "";
      if (!raw) {
        phone = null;
      } else {
        const digits = phoneToStoredDigits(raw);
        if (!digits) {
          throw new BadRequestError("Invalid phone number.");
        }
        phone = digits;
      }
    }

    if (!email && !phone) {
      throw new BadRequestError("Email or phone is required.");
    }

    if (email) {
      const [conflict] = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.email, email), ne(people.id, personId)))
        .limit(1);
      if (conflict) {
        throw new ConflictError("Another person already uses this email.");
      }
    }

    if (phone) {
      const [conflict] = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.phone, phone), ne(people.id, personId)))
        .limit(1);
      if (conflict) {
        throw new ConflictError("Another person already uses this phone number.");
      }
    }

    const emailChanged = data.email !== undefined && email !== existing.email;
    const phoneChanged = data.phoneE164 !== undefined && phone !== existing.phone;

    let emailVerifiedAt = existing.emailVerifiedAt;
    let phoneVerifiedAt = existing.phoneVerifiedAt;

    if (emailChanged) {
      emailVerifiedAt = email ? null : null;
    }
    if (phoneChanged) {
      phoneVerifiedAt = phone ? null : null;
    }
    if (!email) {
      emailVerifiedAt = null;
    }
    if (!phone) {
      phoneVerifiedAt = null;
    }

    return {
      givenName,
      familyName,
      email,
      phone,
      emailVerifiedAt,
      phoneVerifiedAt,
      updatedAt: new Date(),
    };
  }

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

  async ensurePersonInTx(
    tx: PeopleTx,
    params: {
      givenName: string;
      familyName: string;
      email: string | null;
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

  async findPersonIdByEmail(email: string): Promise<string | undefined> {
    const db = getDb();
    const em = normalizeEmailTypo(email.trim()).toLowerCase();
    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.email, em))
      .limit(1);
    return person?.id;
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
    return person?.id;
  }

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

  async getByIds(ids: string[]): Promise<(typeof people.$inferSelect)[]> {
    if (ids.length === 0) {
      return [];
    }
    const db = getDb();
    return db.select().from(people).where(inArray(people.id, ids));
  }

  async getByIdsMap(ids: string[]): Promise<Map<string, typeof people.$inferSelect>> {
    const rows = await this.getByIds(ids);
    return new Map(rows.map((r) => [r.id, r]));
  }

  async searchIdsByAdminQuery(term: string): Promise<string[]> {
    const q = term.trim();
    if (!q) {
      return [];
    }
    const pattern = `%${q}%`;
    const db = getDb();
    const rows = await db
      .select({ id: people.id })
      .from(people)
      .where(
        or(
          ilike(people.email, pattern),
          ilike(people.givenName, pattern),
          ilike(people.familyName, pattern),
          ilike(people.phone, pattern),
        ),
      );
    return rows.map((r) => r.id);
  }

  async markChannelVerifiedInTx(
    tx: PeopleTx,
    personId: string,
    channel: "email" | "phone",
  ): Promise<void> {
    const person = await this.getInTx(tx, personId);
    if (!person) {
      return;
    }
    const now = new Date();
    if (channel === "email" && person.email?.trim()) {
      await tx
        .update(people)
        .set({
          emailVerifiedAt: person.emailVerifiedAt ?? now,
          updatedAt: now,
        })
        .where(eq(people.id, personId));
      return;
    }
    if (channel === "phone" && person.phone?.trim()) {
      await tx
        .update(people)
        .set({
          phoneVerifiedAt: person.phoneVerifiedAt ?? now,
          updatedAt: now,
        })
        .where(eq(people.id, personId));
    }
  }
}

export const peopleService = new PeopleService();
