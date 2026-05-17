import { and, eq, isNull, or, type SQL } from "drizzle-orm";

import { normalizeEmailTypo } from "../contact.js";
import { getDb } from "../db/index.js";
import { eventInvitees, events } from "../db/schema.js";
import { e164FromStoredDigits, hasMinimumPersonIdentity } from "../profile.js";
import {
  ensurePersonInTx,
  phoneDigitsLookupVariants,
  syncRosterInviteesToPerson,
} from "./people.js";

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

const publishedOrphanInvitee = and(
  isNull(eventInvitees.personId),
  isNull(eventInvitees.revokedAt),
  eq(events.status, "published"),
);

export class MaterializeInviteeError extends Error {
  constructor(
    message: string,
    public readonly code: "identity_conflict" | "duplicate_contact" | "not_found",
  ) {
    super(message);
    this.name = "MaterializeInviteeError";
  }
}

function isPostgresUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "23505"
  );
}

/** Create people row from invitee contact + provided names; link event_invitees.person_id. */
export async function materializePersonFromInvitee(
  inviteeId: string,
  identity: { givenName: string; familyName: string },
  tx?: DbTx,
): Promise<string> {
  const run = async (innerTx: DbTx) => {
    const [inv] = await innerTx
      .select()
      .from(eventInvitees)
      .where(eq(eventInvitees.id, inviteeId))
      .limit(1);
    if (!inv) {
      throw new MaterializeInviteeError("Invitee not found.", "not_found");
    }
    if (inv.personId) {
      return inv.personId;
    }

    const email = inv.email?.trim().toLowerCase() ?? null;
    const phoneDigits = inv.phone ?? null;
    const givenName = identity.givenName.trim();
    const familyName = identity.familyName.trim();

    if (
      !hasMinimumPersonIdentity({
        givenName,
        familyName,
        email,
        phoneE164: phoneDigits ? e164FromStoredDigits(phoneDigits) : null,
      })
    ) {
      throw new MaterializeInviteeError(
        "Invitee does not have enough identity to create a person.",
        "not_found",
      );
    }

    try {
      const personId = await ensurePersonInTx(innerTx, {
        givenName,
        familyName,
        email,
        phoneE164: phoneDigits ? e164FromStoredDigits(phoneDigits) : null,
      });
      await innerTx
        .update(eventInvitees)
        .set({ personId })
        .where(eq(eventInvitees.id, inviteeId));
      return personId;
    } catch (e) {
      if (e instanceof Error && e.message === "identity_conflict") {
        throw new MaterializeInviteeError(
          "Email and phone belong to different people.",
          "identity_conflict",
        );
      }
      if (isPostgresUniqueViolation(e)) {
        throw new MaterializeInviteeError(
          "Email or phone is already in use.",
          "duplicate_contact",
        );
      }
      throw e;
    }
  };

  if (tx) {
    return run(tx);
  }
  const db = getDb();
  return db.transaction(run);
}

export function pendingIdentityFromInvitee(inv: {
  email: string | null;
  phone: string | null;
}): {
  email: string | null;
  phoneE164: string | null;
} {
  return {
    email: inv.email?.trim().toLowerCase() ?? null,
    phoneE164: inv.phone ? e164FromStoredDigits(inv.phone) : null,
  };
}

export function shouldMaterializeInvitee(inv: {
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
}): boolean {
  return hasMinimumPersonIdentity({
    givenName: inv.givenName.trim(),
    familyName: inv.familyName.trim(),
    email: inv.email?.trim().toLowerCase() ?? null,
    phoneE164: inv.phone ? e164FromStoredDigits(inv.phone) : null,
  });
}

/** Placeholder names until the guest completes profile after OTP sign-in. */
const REGISTRATION_BOOTSTRAP_GIVEN = "Invitee";
const REGISTRATION_BOOTSTRAP_FAMILY = "Pending";

/**
 * Roster row has email/phone but no `person_id` yet (profile pending at invite time).
 * Creates or merges a `people` row from roster contact and links the invitee.
 */
export async function resolvePersonIdFromPendingRosterContact(
  contact: { kind: "email"; email: string } | { kind: "phone"; e164: string },
): Promise<string | undefined> {
  const inviteeId = await findPublishedOrphanInviteeId(contact);
  if (!inviteeId) {
    return undefined;
  }

  try {
    const personId = await bootstrapPersonFromOrphanInvitee(inviteeId);
    await syncRosterInviteesToPerson(personId);
    return personId;
  } catch (e) {
    if (e instanceof Error && e.message === "identity_conflict") {
      return undefined;
    }
    throw e;
  }
}

async function findPublishedOrphanInviteeId(
  contact: { kind: "email"; email: string } | { kind: "phone"; e164: string },
): Promise<string | undefined> {
  if (contact.kind === "email") {
    return findPublishedOrphanInviteeIdByEmail(contact.email);
  }
  return findPublishedOrphanInviteeIdByPhone(contact.e164);
}

async function findPublishedOrphanInviteeIdByEmail(
  email: string,
): Promise<string | undefined> {
  const em = normalizeEmailTypo(email.trim()).toLowerCase();
  const db = getDb();
  const [row] = await db
    .select({ id: eventInvitees.id })
    .from(eventInvitees)
    .innerJoin(events, eq(events.id, eventInvitees.eventId))
    .where(and(publishedOrphanInvitee, eq(eventInvitees.email, em)))
    .limit(1);
  return row?.id;
}

async function findPublishedOrphanInviteeIdByPhone(
  phoneE164: string,
): Promise<string | undefined> {
  const variants = phoneDigitsLookupVariants(phoneE164);
  if (variants.length === 0) {
    return undefined;
  }

  const phoneMatch = orClauses(variants.map((d) => eq(eventInvitees.phone, d)));
  if (!phoneMatch) {
    return undefined;
  }

  const db = getDb();
  const [row] = await db
    .select({ id: eventInvitees.id })
    .from(eventInvitees)
    .innerJoin(events, eq(events.id, eventInvitees.eventId))
    .where(and(publishedOrphanInvitee, phoneMatch))
    .limit(1);
  return row?.id;
}

async function bootstrapPersonFromOrphanInvitee(inviteeId: string): Promise<string> {
  const db = getDb();
  return db.transaction(async (innerTx) => {
    const [row] = await innerTx
      .select({ invitee: eventInvitees, event: events })
      .from(eventInvitees)
      .innerJoin(events, eq(events.id, eventInvitees.eventId))
      .where(eq(eventInvitees.id, inviteeId))
      .limit(1);
    if (!row) {
      throw new MaterializeInviteeError("Invitee not found.", "not_found");
    }
    if (row.invitee.personId) {
      return row.invitee.personId;
    }
    if (row.event.status !== "published") {
      throw new MaterializeInviteeError("Invitee not eligible.", "not_found");
    }
    if (row.invitee.revokedAt) {
      throw new MaterializeInviteeError("Invitee not eligible.", "not_found");
    }

    const inv = row.invitee;
    const email = inv.email?.trim().toLowerCase() ?? null;
    const phoneE164 = inv.phone ? e164FromStoredDigits(inv.phone) : null;
    if (!email && !phoneE164) {
      throw new MaterializeInviteeError(
        "Invitee does not have enough identity to create a person.",
        "not_found",
      );
    }

    const personId = await ensurePersonInTx(innerTx, {
      givenName: REGISTRATION_BOOTSTRAP_GIVEN,
      familyName: REGISTRATION_BOOTSTRAP_FAMILY,
      email,
      phoneE164,
    });
    await innerTx
      .update(eventInvitees)
      .set({ personId })
      .where(eq(eventInvitees.id, inviteeId));
    return personId;
  });
}
