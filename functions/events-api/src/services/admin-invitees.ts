import { and, eq, isNull } from "drizzle-orm";

import { phoneToStoredDigits } from "../contact.js";
import { getDb } from "../db/index.js";
import { eventInvitees, people } from "../db/schema.js";
import {
  ensureHostInviteLinkForPersonInTx,
  mintOrRotateHostInviteLinkForPersonInTx,
} from "./host-invite-link.js";
import {
  findPersonIdByEmail,
  findPersonIdByPhoneE164,
} from "./people.js";
import {
  materializePersonFromInvitee,
  MaterializeInviteeError,
  shouldMaterializeInvitee,
} from "./materialize-invitee-person.js";
import { requireInviteOnlyEvent } from "./event-read.js";

export { InviteMechanismDisabledError } from "./event-read.js";

export type InviteeInput = {
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
  /** Max guest redemptions when minting an admin link via regenerate (not stored on event invite). */
  maxRedemptions: number | null;
  notes: string | null;
};

export type UpsertInviteeResult = {
  inviteeId: string;
  personId?: string | null;
  status: "created" | "skipped";
};

export type UpsertInviteesSummary = {
  results: UpsertInviteeResult[];
  created: number;
  skipped: number;
  invalid: number;
};

export class InviteeUpsertError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "contact_required"
      | "identity_conflict"
      | "already_invited"
      | "duplicate_contact",
  ) {
    super(message);
    this.name = "InviteeUpsertError";
  }
}

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

type NormalizedInvitee = {
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

function normalizeInviteeInput(inv: InviteeInput): NormalizedInvitee {
  const emailRaw = inv.email?.trim().toLowerCase();
  return {
    givenName: inv.givenName?.trim() ?? "",
    familyName: inv.familyName?.trim() ?? "",
    email: emailRaw || null,
    phone: phoneToStoredDigits(inv.phoneE164),
    notes: inv.notes ?? null,
  };
}

function hasEventInviteIdentity(norm: {
  email: string | null;
  phone: string | null;
}): boolean {
  return Boolean(norm.email || norm.phone);
}

async function findExistingInviteeOnEvent(
  tx: DbTx,
  eventId: string,
  email: string | null,
  phone: string | null,
): Promise<typeof eventInvitees.$inferSelect | null> {
  const base = and(eq(eventInvitees.eventId, eventId), isNull(eventInvitees.revokedAt));

  if (email) {
    const [byPending] = await tx
      .select()
      .from(eventInvitees)
      .where(and(base, eq(eventInvitees.email, email)))
      .limit(1);
    if (byPending) {
      return byPending;
    }

    const [byPersonEmail] = await tx
      .select({ inv: eventInvitees })
      .from(eventInvitees)
      .innerJoin(people, eq(people.id, eventInvitees.personId))
      .where(and(base, eq(people.email, email)))
      .limit(1);
    if (byPersonEmail) {
      return byPersonEmail.inv;
    }
  }

  if (phone) {
    const [byPending] = await tx
      .select()
      .from(eventInvitees)
      .where(and(base, eq(eventInvitees.phone, phone)))
      .limit(1);
    if (byPending) {
      return byPending;
    }

    const [byPersonPhone] = await tx
      .select({ inv: eventInvitees })
      .from(eventInvitees)
      .innerJoin(people, eq(people.id, eventInvitees.personId))
      .where(and(base, eq(people.phone, phone)))
      .limit(1);
    if (byPersonPhone) {
      return byPersonPhone.inv;
    }
  }

  return null;
}

async function assertNoIdentityConflict(
  email: string | null,
  phone: string | null,
): Promise<void> {
  if (!email || !phone) {
    return;
  }
  const byEmail = await findPersonIdByEmail(email);
  const byPhone = await findPersonIdByPhoneE164(`+${phone}`);
  if (byEmail && byPhone && byEmail !== byPhone) {
    throw new InviteeUpsertError(
      `Invitee identity conflict for ${email}: email and phone belong to different people.`,
      "identity_conflict",
    );
  }
}

export async function upsertInviteesForEvent(
  eventId: string,
  invitees: InviteeInput[],
): Promise<UpsertInviteesSummary> {
  await requireInviteOnlyEvent(eventId);
  const db = getDb();
  const results: UpsertInviteeResult[] = [];
  let created = 0;
  let skipped = 0;
  let invalid = 0;

  await db.transaction(async (tx) => {
    for (const inv of invitees) {
      const norm = normalizeInviteeInput(inv);
      if (!hasEventInviteIdentity(norm)) {
        invalid++;
        continue;
      }

      await assertNoIdentityConflict(norm.email, norm.phone);

      const existingOnEvent = await findExistingInviteeOnEvent(
        tx,
        eventId,
        norm.email,
        norm.phone,
      );
      if (existingOnEvent) {
        results.push({
          inviteeId: existingOnEvent.id,
          personId: existingOnEvent.personId,
          status: "skipped",
        });
        skipped++;
        continue;
      }

      const [ins] = await tx
        .insert(eventInvitees)
        .values({
          eventId,
          personId: null,
          inviterId: null,
          email: norm.email,
          phone: norm.phone,
          notes: norm.notes ?? undefined,
        })
        .returning({ id: eventInvitees.id });
      const inviteeId = ins!.id;

      let personId: string | null = null;
      if (shouldMaterializeInvitee(norm)) {
        try {
          personId = await materializePersonFromInvitee(
            inviteeId,
            { givenName: norm.givenName, familyName: norm.familyName },
            tx,
          );
        } catch (e) {
          if (e instanceof MaterializeInviteeError) {
            if (e.code === "identity_conflict") {
              throw new InviteeUpsertError(e.message, "identity_conflict");
            }
            if (e.code === "duplicate_contact") {
              throw new InviteeUpsertError(e.message, "duplicate_contact");
            }
          }
          throw e;
        }
      }

      results.push({ inviteeId, personId, status: "created" });
      created++;
    }
  });

  if (invitees.length > 0 && created === 0 && skipped === 0 && invalid === invitees.length) {
    throw new InviteeUpsertError(
      "No valid invitees: each row needs a recognizable email or phone number.",
      "contact_required",
    );
  }

  return { results, created, skipped, invalid };
}

export async function revokeInvitee(eventId: string, inviteeId: string): Promise<boolean> {
  await requireInviteOnlyEvent(eventId);
  const db = getDb();
  const res = await db
    .update(eventInvitees)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(eventInvitees.id, inviteeId), eq(eventInvitees.eventId, eventId)),
    )
    .returning({ id: eventInvitees.id });
  return res.length > 0;
}

export type RegenerateInviteLinkResult =
  | { ok: true; inviteToken: string }
  | {
      ok: false;
      reason: "invitee_not_found" | "profile_pending" | "not_eligible_host";
    };

export type EnsureInviteLinkResult = RegenerateInviteLinkResult;

/** Create host share link if missing; does not rotate an existing token. */
export async function ensureInviteLink(
  eventId: string,
  inviteeId: string,
): Promise<EnsureInviteLinkResult> {
  await requireInviteOnlyEvent(eventId);
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [inv] = await tx
      .select({
        personId: eventInvitees.personId,
        inviterId: eventInvitees.inviterId,
      })
      .from(eventInvitees)
      .where(
        and(
          eq(eventInvitees.id, inviteeId),
          eq(eventInvitees.eventId, eventId),
          isNull(eventInvitees.revokedAt),
        ),
      )
      .limit(1);
    if (!inv) {
      return { ok: false, reason: "invitee_not_found" };
    }
    if (!inv.personId) {
      return { ok: false, reason: "profile_pending" };
    }
    if (inv.inviterId != null) {
      return { ok: false, reason: "not_eligible_host" };
    }

    const raw = await ensureHostInviteLinkForPersonInTx(tx, eventId, inv.personId);
    if (!raw) {
      return { ok: false, reason: "invitee_not_found" };
    }
    return { ok: true, inviteToken: raw };
  });
}

/** Mint or rotate the host share link in this invitee's name (inviterId = personId). */
export async function regenerateInviteLink(
  eventId: string,
  inviteeId: string,
  maxRedemptions?: number | null,
): Promise<RegenerateInviteLinkResult> {
  await requireInviteOnlyEvent(eventId);
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [inv] = await tx
      .select({
        personId: eventInvitees.personId,
        inviterId: eventInvitees.inviterId,
      })
      .from(eventInvitees)
      .where(
        and(
          eq(eventInvitees.id, inviteeId),
          eq(eventInvitees.eventId, eventId),
          isNull(eventInvitees.revokedAt),
        ),
      )
      .limit(1);
    if (!inv) {
      return { ok: false, reason: "invitee_not_found" };
    }
    if (!inv.personId) {
      return { ok: false, reason: "profile_pending" };
    }
    if (inv.inviterId != null) {
      return { ok: false, reason: "not_eligible_host" };
    }

    const raw = await mintOrRotateHostInviteLinkForPersonInTx(
      tx,
      eventId,
      inv.personId,
      maxRedemptions,
    );
    if (!raw) {
      return { ok: false, reason: "invitee_not_found" };
    }
    return { ok: true, inviteToken: raw };
  });
}
