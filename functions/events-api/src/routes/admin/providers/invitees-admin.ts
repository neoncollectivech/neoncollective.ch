import { phoneToStoredDigits } from "../../../helpers/contact";
import { e164FromStoredDigits, hasMinimumPersonIdentity } from "../../../helpers/profile";
import { runTransaction, type EntityTx } from "../../../services/transaction";
import { eventsService } from "../../../services/events.service";
import { eventInviteesService } from "../../../services/event-invitees.service";
import {
  ensureHostInviteLinkForPersonInTx,
  mintOrRotateHostInviteLinkForPersonInTx,
} from "../../shared/invite-links-orchestration";
import {
  IdentityConflictError,
  peopleService,
} from "../../../services/people.service";

export class MaterializeInviteeError extends Error {
  constructor(
    message: string,
    public readonly code: "identity_conflict" | "duplicate_contact" | "not_found",
  ) {
    super(message);
    this.name = "MaterializeInviteeError";
  }
}

export type InviteeInput = {
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
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

export type RegenerateInviteLinkResult =
  | { ok: true; inviteToken: string }
  | {
      ok: false;
      reason: "invitee_not_found" | "profile_pending" | "not_eligible_host";
    };

export type EnsureInviteLinkResult = RegenerateInviteLinkResult;

function shouldMaterializeInvitee(inv: {
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

export async function materializePersonFromInvitee(
  inviteeId: string,
  identity: { givenName: string; familyName: string },
  tx?: EntityTx,
): Promise<string> {
  const run = async (innerTx: EntityTx) => {
    const inv = await eventInviteesService.getInTx(innerTx, inviteeId);
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
      await eventInviteesService.setPersonIdInTx(innerTx, inviteeId, personId);
      return personId;
    } catch (e) {
      if (e instanceof IdentityConflictError) {
        throw new MaterializeInviteeError(
          "Email and phone belong to different people.",
          "identity_conflict",
        );
      }
      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code: string }).code === "23505"
      ) {
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
  return runTransaction(run);
}

export async function upsertInviteesForEvent(
  eventId: string,
  invitees: InviteeInput[],
): Promise<UpsertInviteesSummary> {
  await eventsService.requireInviteOnly(eventId);
  const results: UpsertInviteeResult[] = [];
  let created = 0;
  let skipped = 0;
  let invalid = 0;

  await runTransaction(async (tx) => {
    for (const inv of invitees) {
      const emailRaw = inv.email?.trim().toLowerCase();
      const norm = {
        givenName: inv.givenName?.trim() ?? "",
        familyName: inv.familyName?.trim() ?? "",
        email: emailRaw || null,
        phone: phoneToStoredDigits(inv.phoneE164),
        notes: inv.notes ?? null,
      };

      if (!norm.email && !norm.phone) {
        invalid++;
        continue;
      }

      if (norm.email && norm.phone) {
        const byEmail =
          (await peopleService.findPersonIdByEmail(norm.email)) ??
          (await eventInviteesService.findLinkedPersonIdByEmail(norm.email));
        const byPhone =
          (await peopleService.findPersonIdByPhoneE164(`+${norm.phone}`)) ??
          (await eventInviteesService.findLinkedPersonIdByPhoneE164(`+${norm.phone}`));
        if (byEmail && byPhone && byEmail !== byPhone) {
          throw new InviteeUpsertError(
            `Invitee identity conflict for ${norm.email}: email and phone belong to different people.`,
            "identity_conflict",
          );
        }
      }

      const existingOnEvent = await eventInviteesService.findActiveInviteeByContactOnEvent(
        eventId,
        {
          email: norm.email,
          phoneDigits: norm.phone,
          phoneE164: norm.phone ? `+${norm.phone}` : null,
        },
        tx,
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

      const inviteeId = await eventInviteesService.createAdminInviteeInTx(tx, {
        eventId,
        email: norm.email,
        phone: norm.phone,
        notes: norm.notes,
      });

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

export async function revokeEventInvitee(
  eventId: string,
  inviteeId: string,
): Promise<boolean> {
  await eventsService.requireInviteOnly(eventId);
  return eventInviteesService.revokeInTx(eventId, inviteeId);
}

export async function ensureInviteeHostLink(
  eventId: string,
  inviteeId: string,
): Promise<EnsureInviteLinkResult> {
  await eventsService.requireInviteOnly(eventId);
  return runTransaction(async (tx) => {
    const inv = await eventInviteesService.getActiveOnEventInTx(tx, eventId, inviteeId);
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

export async function regenerateInviteeHostLink(
  eventId: string,
  inviteeId: string,
  maxRedemptions?: number | null,
): Promise<RegenerateInviteLinkResult> {
  await eventsService.requireInviteOnly(eventId);
  return runTransaction(async (tx) => {
    const inv = await eventInviteesService.getActiveOnEventInTx(tx, eventId, inviteeId);
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
