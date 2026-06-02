import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AppEnv } from "../auth/env";
import { authFactory } from "../auth/factory";
import { eventApiKeyBearerAuth } from "../auth/middleware/event-api-key";
import { checkInSchema } from "../schemas";
import { admissionsService } from "../services/admissions.service";
import { jsonReasonFailure } from "./shared/respond";

const CHECK_IN_ERRORS = {
  admission_not_found: {
    status: 404 as ContentfulStatusCode,
    error: "Place not found or already checked in.",
  },
} as const;

export function createCheckInRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post(
    "/check-in",
    ...authFactory.createHandlers(
      eventApiKeyBearerAuth,
      arktypeValidator("json", checkInSchema),
      async (c) => {
        const body = c.req.valid("json");
        const apiKey = c.var.eventApiKey!;
        const res = await admissionsService.checkInByToken({
          token: body.token,
          checkedInBy: `api-key:${apiKey.label}`,
          restrictToEventId: apiKey.eventId,
        });
        if (!res.ok) {
          return jsonReasonFailure(c, res, CHECK_IN_ERRORS);
        }
        return c.json({ ok: true });
      },
    ),
  );

  return router;
}
