import { and, eq, isNotNull, isNull, or } from "drizzle-orm";

import { normalizeEmailTypo, phoneToStoredDigits } from "../contact.js";
import { getDb } from "../db/index.js";
import {
  eventInvitees,
  events,
  orders,
  people,
} from "../db/schema.js";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

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
  const now = new Date();

  if (existing) {
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

function rosterContactMatchForPerson(person: {
  email: string | null;
  phone: string | null;
}) {
  const contactMatch = [];
  if (person.email?.trim()) {
    contactMatch.push(eq(eventInvitees.email, person.email.trim().toLowerCase()));
  }
  if (person.phone?.trim()) {
    const stored = person.phone.trim();
    contactMatch.push(eq(eventInvitees.phone, stored));
    for (const variant of phoneDigitsLookupVariants(`+${stored}`)) {
      if (variant !== stored) {
        contactMatch.push(eq(eventInvitees.phone, variant));
      }
    }
  }
  return contactMatch.length > 0 ? or(...contactMatch) : null;
}

/** Link roster rows that match this person's contact but lack `person_id`. */
export async function syncRosterInviteesToPerson(personId: string): Promise<void> {
  const db = getDb();
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) {
    return;
  }
  const contactMatch = rosterContactMatchForPerson(person);
  if (!contactMatch) {
    return;
  }
  await db
    .update(eventInvitees)
    .set({ personId })
    .where(and(isNull(eventInvitees.personId), contactMatch));
}

export async function personHasRegistrationEligibility(
  personId: string,
): Promise<boolean> {
  const db = getDb();
  const [o] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.personId, personId))
    .limit(1);
  if (o) {
    return true;
  }
  const [i] = await db
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
  if (i) {
    return true;
  }

  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) {
    return false;
  }
  const contactMatch = rosterContactMatchForPerson(person);
  if (!contactMatch) {
    return false;
  }
  const [roster] = await db
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
  return Boolean(roster);
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
  const [r] = await db.select({ id: people.id }).from(people).where(eq(people.email, em)).limit(1);
  if (r) {
    return r.id;
  }
  const [inv] = await db
    .select({ personId: eventInvitees.personId })
    .from(eventInvitees)
    .where(and(eq(eventInvitees.email, em), isNotNull(eventInvitees.personId)))
    .limit(1);
  return inv?.personId ?? undefined;
}

export async function findPersonIdByPhoneE164(
  phoneE164: string,
): Promise<string | undefined> {
  const variants = phoneDigitsLookupVariants(phoneE164);
  if (variants.length === 0) {
    return undefined;
  }
  const db = getDb();
  const [r] = await db
    .select({ id: people.id })
    .from(people)
    .where(or(...variants.map((d) => eq(people.phone, d))))
    .limit(1);
  if (r) {
    return r.id;
  }
  const [inv] = await db
    .select({ personId: eventInvitees.personId })
    .from(eventInvitees)
    .where(
      and(
        isNotNull(eventInvitees.personId),
        or(...variants.map((d) => eq(eventInvitees.phone, d))),
      ),
    )
    .limit(1);
  return inv?.personId ?? undefined;
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
