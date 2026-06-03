import { actionProvider } from "@neon/resource-api";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { admissionsService } from "../../../services/admissions.service";

type CancelCheckInFailureReason =
  | "not_found"
  | "not_checked_in"
  | "revoked";

const CANCEL_CHECK_IN_ERRORS: Record<
  CancelCheckInFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  not_found: { status: 404, error: "Admission not found." },
  not_checked_in: { status: 400, error: "Admission is not checked in." },
  revoked: { status: 409, error: "Cannot clear check-in on a revoked admission." },
};

export function createAdmissionsControlRouter(): Hono {
  const control = new Hono();

  control.route(
    "/",
    actionProvider(
      [
        {
          method: "post",
          path: "/:id/cancel-check-in",
          handler: async (c) => {
            const res = await admissionsService.cancelCheckIn(c.req.param("id"));
            if (!res.ok) {
              const mapped = CANCEL_CHECK_IN_ERRORS[res.reason];
              return c.json({ error: mapped.error }, mapped.status);
            }
            return c.json({ ok: true });
          },
        },
      ],
      [],
    ),
  );

  return control;
}
