import { and, eq, isNotNull, isNull, or, type SQL } from "drizzle-orm";

import { normalizeEmailTypo, phoneToStoredDigits } from "../contact.js";
import { getDb } from "../db/index.js";
import {
  eventInvitees,
  events,
  orders,
  people,
} from "../db/schema.js";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function orClauses(clauses: SQL[]): SQL | null {
  if (clauses.length === 0) {
    return null;
  }
  if (clauses.length === 1) {
    return clauses[0]!;
  }
  return or(...clauses)!;
}

/** Resolve or create a `people` row; fills missing phone/email when safe; errors on conflicting identities. */
export async function ensurePersonInTx(
  tx: DbTx,
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
    throw new Error("identity_conflict");
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

function eventInviteContactMatchForPerson(person: {
  email: string | null;
  phone: string | null;
}): SQL | null {
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
export async function syncEventInviteesToPerson(personId: string): Promise<void> {
  const db = getDb();
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) {
    return;
  }

  const contactMatch = eventInviteContactMatchForPerson(person);
  if (!contactMatch) {
    return;
  }

  await db
    .update(eventInvitees)
    .set({ personId })
    .where(and(isNull(eventInvitees.personId), contactMatch));
}

async function hasOrderForPerson(personId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.personId, personId))
    .limit(1);
  return Boolean(row);
}

async function hasLinkedPublishedInvitee(personId: string): Promise<boolean> {
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

async function hasPublishedEventInviteContactMatch(personId: string): Promise<boolean> {
  const db = getDb();
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) {
    return false;
  }

  const contactMatch = eventInviteContactMatchForPerson(person);
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

export async function personHasRegistrationEligibility(
  personId: string,
): Promise<boolean> {
  if (await hasOrderForPerson(personId)) {
    return true;
  }
  if (await hasLinkedPublishedInvitee(personId)) {
    return true;
  }
  if (await hasPublishedEventInviteContactMatch(personId)) {
    return true;
  }
  return false;
}

/** Resolve person for registration sign-in (email or E.164 phone). */
export async function resolvePersonIdForRegistrationContact(
  contact: { kind: "email"; email: string } | { kind: "phone"; e164: string },
): Promise<string | undefined> {
  if (contact.kind === "email") {
    return findPersonIdByEmail(contact.email);
  }

  return findPersonIdByPhoneE164(contact.e164);
}

/** DB digit variants (e.g. 41796829564 vs legacy 0796829564). */
export function phoneDigitsLookupVariants(phoneE164: string): string[] {
  const digits = phoneToStoredDigits(phoneE164);
  if (!digits) {
    return [];
  }

  const variants = new Set<string>([digits]);
  if (digits.startsWith("41") && digits.length >= 11) {
    variants.add(`0${digits.slice(2)}`);
  }
  if (digits.startsWith("0") && digits.length >= 10 && !digits.startsWith("00")) {
    variants.add(`41${digits.slice(1)}`);
  }
  return [...variants];
}

export async function findPersonIdByEmail(email: string): Promise<string | undefined> {
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

export async function findPersonIdByPhoneE164(
  phoneE164: string,
): Promise<string | undefined> {
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
export async function attachPhoneToPerson(params: {
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
