import { and, eq, isNull } from "drizzle-orm";

import { normalizeEmailTypo, phoneDigitsLookupVariants } from "../contact";
import { getDb } from "../db/index";
import { eventInvitees, events } from "../db/schema";
import { e164FromStoredDigits, hasMinimumPersonIdentity } from "../profile";
import { orClauses } from "./base/sql-utils";
import { IdentityConflictError, peopleService } from "./people.service";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

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
      const personId = await peopleService.ensurePersonInTx(innerTx, {
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
      if (e instanceof IdentityConflictError) {
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

/** Published event invite with contact but no linked person yet. */
export async function findPublishedOrphanInviteeId(
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

export async function loadPublishedOrphanInviteeContact(
  inviteeId: string,
): Promise<{ email: string | null; phoneE164: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({ invitee: eventInvitees, event: events })
    .from(eventInvitees)
    .innerJoin(events, eq(events.id, eventInvitees.eventId))
    .where(eq(eventInvitees.id, inviteeId))
    .limit(1);
  if (!row) {
    return null;
  }
  if (row.invitee.personId || row.invitee.revokedAt || row.event.status !== "published") {
    return null;
  }
  return pendingIdentityFromInvitee(row.invitee);
}
