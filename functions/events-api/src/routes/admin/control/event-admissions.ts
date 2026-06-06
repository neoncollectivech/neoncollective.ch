import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AppEnv } from "../../../auth/env";
import { admissionSigningKeysService } from "../../../services/admission-signing-keys.service";
import { admissionsService } from "../../../services/admissions.service";
import { eventRegistrationsService } from "../../../services/event-registrations.service";
import { eventsService } from "../../../services/events.service";
import { runTransaction } from "../../../services/transaction";
import { jsonReasonFailure } from "../../shared/respond";

const ADMISSION_ERRORS = {
  event_not_found: { status: 404 as ContentfulStatusCode, error: "Event not found." },
  signing_key_missing: {
    status: 409 as ContentfulStatusCode,
    error: "Create an event signing key before issuing admissions.",
  },
} as const;

export async function getEventAdmissionsSummaryHandler(
  c: Context<AppEnv>,
): Promise<Response> {
  const eventId = c.req.param("id")!;
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, ADMISSION_ERRORS);
  }

  const signingMeta = await admissionSigningKeysService.getPublicMetaForEvent(eventId);
  const counts = await runTransaction((tx) =>
    admissionsService.countRegistrationAdmissionsGapInTx(tx, eventId),
  );

  return c.json({
    signingKey: signingMeta
      ? { kid: signingMeta.kid, createdAt: signingMeta.createdAt.toISOString() }
      : null,
    confirmedRegistrations: counts.confirmedRegistrations,
    withAdmission: counts.withAdmission,
    eligibleWithoutAdmission: counts.eligibleWithoutAdmission,
  });
}

export async function provisionEventAdmissionSigningKeyHandler(
  c: Context<AppEnv>,
): Promise<Response> {
  const eventId = c.req.param("id")!;
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, ADMISSION_ERRORS);
  }

  const existing = await admissionSigningKeysService.getPublicMetaForEvent(eventId);
  if (existing) {
    return c.json({
      alreadyExists: true,
      signingKey: {
        kid: existing.kid,
        createdAt: existing.createdAt.toISOString(),
      },
    });
  }

  const row = await admissionSigningKeysService.provisionForEvent(eventId);

  return c.json(
    {
      alreadyExists: false,
      signingKey: {
        kid: row.kid,
        createdAt: row.createdAt.toISOString(),
      },
    },
    201,
  );
}

export async function generateEventAdmissionsHandler(
  c: Context<AppEnv>,
): Promise<Response> {
  const eventId = c.req.param("id")!;
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, ADMISSION_ERRORS);
  }

  const signingKey = await admissionSigningKeysService.getForEvent(eventId);
  if (!signingKey) {
    return jsonReasonFailure(c, { reason: "signing_key_missing" }, ADMISSION_ERRORS);
  }

  const result = await runTransaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    let failed = 0;

    const registrations = await eventRegistrationsService.listConfirmedForEventInTx(
      tx,
      eventId,
    );

    for (const registration of registrations) {
      const existing = await admissionsService.hasActiveAdmissionForRegistrationInTx(
        tx,
        registration.id,
      );
      if (existing) {
        skipped += 1;
        continue;
      }

      const issued = await admissionsService.issueAdmissionForPaidOrderInTx(
        tx,
        registration.primaryOrderId,
      );
      if (issued.ok) {
        created += 1;
      } else {
        failed += 1;
      }
    }

    return { created, skipped, failed };
  });

  return c.json(result);
}

export async function regenerateEventAdmissionsHandler(
  c: Context<AppEnv>,
): Promise<Response> {
  const eventId = c.req.param("id")!;
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, ADMISSION_ERRORS);
  }

  const signingKey = await admissionSigningKeysService.getForEvent(eventId);
  if (!signingKey) {
    return jsonReasonFailure(c, { reason: "signing_key_missing" }, ADMISSION_ERRORS);
  }

  const result = await runTransaction((tx) =>
    admissionsService.regenerateAllAdmissionsForEventInTx(tx, eventId),
  );

  return c.json(result);
}
