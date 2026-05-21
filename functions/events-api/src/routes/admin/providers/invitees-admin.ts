import { type ListQuery, type ListResult } from "@neon/admin-crud";

import { phoneToStoredDigits } from "../../../helpers/contact";
import { e164FromStoredDigits, hasMinimumPersonIdentity } from "../../../helpers/profile";
import { runTransaction, type EntityTx } from "../../../services/transaction";
import type { ServiceContext } from "../../../services/base/types";
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
import { inviteLinksService } from "../../../services/invite-links.service";
import { ordersService } from "../../../services/orders.service";

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

type InviteLinkRow = {
  id: string;
  inviterId: string | null;
  token: string;
  maxRedemptions: number;
  rotatedAt: Date | null;
};

function formatHostInviteLink(
  hostLink: InviteLinkRow,
  usedByLinkId: Map<string, number>,
) {
  const usedRedemptions = usedByLinkId.get(hostLink.id) ?? 0;
  const remainingRedemptions = Math.max(0, hostLink.maxRedemptions - usedRedemptions);
  return {
    id: hostLink.id,
    token: hostLink.token,
    maxRedemptions: hostLink.maxRedemptions,
    usedRedemptions,
    remainingRedemptions,
    rotatedAt: hostLink.rotatedAt,
  };
}

type InviteeRow = NonNullable<Awaited<ReturnType<typeof eventInviteesService.get>>>;
type PersonRow = NonNullable<Awaited<ReturnType<typeof peopleService.get>>>;

function formatInviteeRow(
  r: {
    invitee: InviteeRow;
    person: PersonRow | null;
  },
  links: InviteLinkRow[],
  usedByLinkId: Map<string, number>,
) {
  const person = r.person;
  const pendingEmail = r.invitee.email;
  const pendingPhone = r.invitee.phone;
  const hostLink =
    r.invitee.personId != null && r.invitee.inviterId == null
      ? links.find((l) => l.inviterId === r.invitee.personId) ?? null
      : null;
  return {
    id: r.invitee.id,
    eventId: r.invitee.eventId,
    personId: r.invitee.personId,
    inviterId: r.invitee.inviterId,
    profilePending: r.invitee.personId == null,
    notes: r.invitee.notes,
    revokedAt: r.invitee.revokedAt,
    createdAt: r.invitee.createdAt,
    person: {
      id: person?.id ?? null,
      givenName: person?.givenName ?? "",
      familyName: person?.familyName ?? "",
      email: person?.email ?? pendingEmail,
      phone: person?.phone ?? pendingPhone,
      phoneE164: e164FromStoredDigits(person?.phone ?? pendingPhone ?? null),
    },
    hostInviteLink: hostLink ? formatHostInviteLink(hostLink, usedByLinkId) : null,
  };
}

function resolveEventId(ctx?: ServiceContext): string | undefined {
  return ctx?.parent?.value ?? ctx?.hono?.req.param("eventId");
}

async function listInviteesForEvent(eventId: string) {
  const invitees = await eventInviteesService.listByEventId(eventId);
  const personIds = invitees.map((i) => i.personId).filter((id): id is string => Boolean(id));
  const peopleById = await peopleService.getByIdsMap(personIds);
  const links = await inviteLinksService.listByEventId(eventId);
  const hostLinkIds = links.filter((l) => l.inviterId != null).map((l) => l.id);
  const usedByLinkId = await ordersService.countPendingOrPaidForInviteLinkIds(hostLinkIds);

  return invitees.map((invitee) =>
    formatInviteeRow(
      {
        invitee,
        person: invitee.personId ? (peopleById.get(invitee.personId) ?? null) : null,
      },
      links,
      usedByLinkId,
    ),
  );
}

export async function getAdminInviteeDetail(id: string, ctx?: ServiceContext) {
  const eventId = resolveEventId(ctx);
  if (!eventId) {
    return null;
  }
  const invitee = await eventInviteesService.get(id);
  if (!invitee || invitee.eventId !== eventId) {
    return null;
  }
  const person = invitee.personId ? await peopleService.get(invitee.personId) : null;
  const links = await inviteLinksService.listByEventId(eventId);
  const hostLinkIds = links.filter((l) => l.inviterId != null).map((l) => l.id);
  const usedByLinkId = await ordersService.countPendingOrPaidForInviteLinkIds(hostLinkIds);
  return formatInviteeRow({ invitee, person }, links, usedByLinkId);
}

export async function listAdminEventInvitees(
  query: ListQuery<Record<string, never>>,
  ctx?: ServiceContext,
): Promise<ListResult<unknown>> {
  const eventId = resolveEventId(ctx);
  if (!eventId) {
    return eventInviteesService.list(query, ctx);
  }
  const items = await listInviteesForEvent(eventId);
  return {
    items,
    meta: {
      total: items.length,
      limit: query.limit,
      skip: 0,
    },
  };
}

export async function countAdminEventInvitees(
  query: ListQuery<Record<string, never>>,
  ctx?: ServiceContext,
): Promise<number> {
  const eventId = resolveEventId(ctx);
  if (!eventId) {
    return eventInviteesService.count(query, ctx);
  }
  const items = await listInviteesForEvent(eventId);
  return items.length;
}

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
