import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { getEventsApiEnv } from "../config/runtime-env";
import { checkInSchema } from "../schemas";
import { verifyStaffBearer } from "../helpers/staff-auth";
import { admissionsService } from "../services/admissions.service";
import { jsonReasonFailure } from "./shared/respond";

const CHECK_IN_ERRORS = {
  admission_not_found: {
    status: 404 as ContentfulStatusCode,
    error: "Place not found or already checked in.",
  },
} as const;

export function createCheckInRouter(): Hono {
  const router = new Hono();

  router.post("/check-in", arktypeValidator("json", checkInSchema), async (c) => {
    const staff = getEventsApiEnv().staffCheckinToken;
    if (!verifyStaffBearer(c.req.header("Authorization"), staff)) {
      return c.json({ error: "Unauthorized." }, 401);
    }
    const body = c.req.valid("json");
    const res = await admissionsService.checkInByToken({
      token: body.token,
      staffLabel: "staff",
    });
    if (!res.ok) {
      return jsonReasonFailure(c, res, CHECK_IN_ERRORS);
    }
    return c.json({ ok: true });
  });

  return router;
}
