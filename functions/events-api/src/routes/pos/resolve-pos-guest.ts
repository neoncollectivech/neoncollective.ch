import { pruneLocalizedText, type LocalizedText } from "@neon/site-locales";
import { decodeJwt } from "jose";

import { normalizeOptionalPhoneE164 } from "../../helpers/contact";
import { verifyAdmissionCredential } from "../../helpers/admission-jwt";
import { admissionSigningKeysService } from "../../services/admission-signing-keys.service";
import { admissionsService } from "../../services/admissions.service";
import { eventRegistrationsService } from "../../services/event-registrations.service";
import { eventTiersService } from "../../services/event-tiers.service";
import { ordersService } from "../../services/orders.service";
import { orderTiersService } from "../../services/order-tiers.service";
import { peopleService, IdentityConflictError } from "../../services/people.service";
import { enrichTiersWithCapacityStats } from "../../helpers/tier-capacity";
import {
  listRegisteredOrderTiersForOrders,
  type RegisteredOrderTierPayload,
} from "../shared/format-order-tiers";
import { runTransaction } from "../../services/transaction";

export type PosGuestTier = {
  id: string;
  name: string;
  description: LocalizedText;
  priceCents: number;
  currency: string;
  placesRemaining: number | null;
  active: boolean;
  sortOrder: number;
  selectionMode: "exclusive" | "addon";
};

export type ResolvedPosGuest = {
  personId: string;
  guestName: string;
  registeredTiers: RegisteredOrderTierPayload[];
  availableUpsellTiers: PosGuestTier[];
  hasPaidExclusive: boolean;
};

async function resolveAvailableUpsellTiersForPerson(params: {
  eventId: string;
  personId: string;
  tiers: PosGuestTier[];
}): Promise<PosGuestTier[]> {
  const addonCandidates = params.tiers.filter(
    (tier) =>
      tier.selectionMode === "addon" &&
      tier.active &&
      (tier.placesRemaining == null || tier.placesRemaining > 0),
  );
  if (addonCandidates.length === 0) {
    return [];
  }
  const orderIds = await ordersService.listIdsForPersonOnEventAndStatuses({
    eventId: params.eventId,
    personId: params.personId,
    statuses: ["pending", "paid"],
  });
  const purchasedTierIds = new Set(
    await orderTiersService.listTierIdsAmongOrderIds(orderIds),
  );
  return addonCandidates.filter((tier) => !purchasedTierIds.has(tier.id));
}

async function resolveGuestFromCredential(
  eventId: string,
  credential: string,
): Promise<
  | { ok: true; personId: string; guestName: string }
  | { ok: false; reason: "admission_not_found" }
> {
  const trimmed = credential.trim();
  if (!trimmed) {
    return { ok: false, reason: "admission_not_found" };
  }

  let admissionId: string;
  try {
    const payload = decodeJwt(trimmed);
    admissionId = typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    return { ok: false, reason: "admission_not_found" };
  }

  if (!admissionId) {
    return { ok: false, reason: "admission_not_found" };
  }

  const admission = await admissionsService.get(admissionId);
  if (!admission || admission.revokedAt || admission.eventId !== eventId) {
    return { ok: false, reason: "admission_not_found" };
  }

  const signingKey = await admissionSigningKeysService.getForEvent(admission.eventId);
  if (!signingKey) {
    return { ok: false, reason: "admission_not_found" };
  }

  const verified = await verifyAdmissionCredential({
    credential: trimmed,
    kid: signingKey.kid,
    publicJwk: signingKey.publicJwk,
  });

  if (!verified || verified.admissionId !== admission.id) {
    return { ok: false, reason: "admission_not_found" };
  }

  const person = await admissionsService.resolvePersonForAdmission(admission);
  if (!person) {
    return { ok: false, reason: "admission_not_found" };
  }

  const guest = await admissionsService.resolveGuestDisplayForAdmission(admission);

  return { ok: true, personId: person.personId, guestName: guest.guestName };
}

export async function resolvePosGuest(params: {
  eventId: string;
  eventQuota: number | null;
  credential?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}): Promise<
  | { ok: true; guest: ResolvedPosGuest }
  | { ok: false; reason: "admission_not_found" | "contact_required" | "identity_conflict" }
> {
  return runTransaction(async (tx) => {
    let personId: string | null = null;
    let guestName = "Guest";

    if (params.credential?.trim()) {
      const fromCredential = await resolveGuestFromCredential(params.eventId, params.credential);
      if (!fromCredential.ok) {
        return fromCredential;
      }
      personId = fromCredential.personId;
      guestName = fromCredential.guestName;
    } else {
      const email = params.email?.trim().toLowerCase() ?? null;
      const phone = params.phoneE164?.trim()
        ? normalizeOptionalPhoneE164(params.phoneE164)
        : null;
      const givenName = params.givenName?.trim() ?? "";
      const familyName = params.familyName?.trim() ?? "";

      if (!email && !phone) {
        return { ok: false, reason: "contact_required" };
      }
      if (!givenName || !familyName) {
        return { ok: false, reason: "contact_required" };
      }

      try {
        personId = await peopleService.ensurePersonInTx(tx, {
          givenName,
          familyName,
          email,
          phoneE164: phone,
        });
      } catch (e) {
        if (e instanceof IdentityConflictError) {
          return { ok: false, reason: "identity_conflict" };
        }
        throw e;
      }

      const person = await peopleService.getInTx(tx, personId);
      if (person) {
        guestName = `${person.givenName} ${person.familyName}`.trim() || "Guest";
      }
    }

    if (!personId) {
      return { ok: false, reason: "contact_required" };
    }

    const activeTiers = await eventTiersService.listActiveForEvent(params.eventId, tx);
    const { tiers: tiersWithSold } = await enrichTiersWithCapacityStats(
      params.eventId,
      params.eventQuota,
      activeTiers,
    );
    const tierPayload: PosGuestTier[] = tiersWithSold.map((t) => ({
      id: t.id,
      name: t.name,
      description: pruneLocalizedText(t.description),
      priceCents: t.priceCents,
      currency: t.currency,
      placesRemaining: t.placesRemaining,
      active: t.active,
      sortOrder: t.sortOrder,
      selectionMode: t.selectionMode,
    }));

    const paidOrderIds = await ordersService.listIdsForPersonOnEventAndStatusesInTx(tx, {
      eventId: params.eventId,
      personId,
      statuses: ["paid"],
    });
    const registeredTiers = await listRegisteredOrderTiersForOrders(paidOrderIds, tx);
    const hasPaidExclusiveResolved =
      await eventRegistrationsService.hasConfirmedRegistrationInTx(
        tx,
        personId,
        params.eventId,
      );

    const availableUpsellTiers = hasPaidExclusiveResolved
      ? await resolveAvailableUpsellTiersForPerson({
          eventId: params.eventId,
          personId,
          tiers: tierPayload,
        })
      : [];

    return {
      ok: true,
      guest: {
        personId,
        guestName,
        registeredTiers,
        availableUpsellTiers,
        hasPaidExclusive: hasPaidExclusiveResolved,
      },
    };
  });
}
