import { eq } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { eventInvitees } from "../db/schema.js";
import { e164FromStoredDigits, hasMinimumPersonIdentity } from "../profile.js";
import { ensurePersonInTx } from "./people.js";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

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
