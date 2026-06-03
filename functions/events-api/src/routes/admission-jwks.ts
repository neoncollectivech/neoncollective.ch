import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AppEnv } from "../auth/env";
import { authFactory } from "../auth/factory";
import { eventApiKeyBearerAuth } from "../auth/middleware/event-api-key";
import { admissionSigningKeysService } from "../services/admission-signing-keys.service";
import { jsonReasonFailure } from "./shared/respond";

const JWKS_ERRORS = {
  event_required: {
    status: 400 as ContentfulStatusCode,
    error: "eventId query parameter is required for global API keys.",
  },
  signing_key_missing: {
    status: 404 as ContentfulStatusCode,
    error: "Admission signing key not found for this event.",
  },
} as const;

export function createAdmissionJwksRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get(
    "/admission/jwks",
    ...authFactory.createHandlers(eventApiKeyBearerAuth, async (c) => {
      const apiKey = c.var.eventApiKey!;
      const queryEventId = c.req.query("eventId")?.trim() || null;
      const eventId = apiKey.eventId ?? queryEventId;

      if (!eventId) {
        return jsonReasonFailure(c, { reason: "event_required" }, JWKS_ERRORS);
      }

      if (apiKey.eventId !== null && apiKey.eventId !== eventId) {
        return jsonReasonFailure(c, { reason: "signing_key_missing" }, JWKS_ERRORS);
      }

      const row = await admissionSigningKeysService.getForEvent(eventId);
      if (!row) {
        return jsonReasonFailure(c, { reason: "signing_key_missing" }, JWKS_ERRORS);
      }

      const meta = await admissionSigningKeysService.getPublicMetaForEvent(eventId);
      const jwks = admissionSigningKeysService.getPublicJwksForEvent({
        kid: row.kid,
        publicJwk: row.publicJwk,
      });

      return c.json({
        eventId,
        kid: meta?.kid ?? row.kid,
        keys: jwks.keys,
      });
    }),
  );

  return router;
}
