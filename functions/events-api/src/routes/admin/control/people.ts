import { actionProvider } from "@neon/resource-api";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  createAdminPerson,
  deleteAdminPerson,
  getAdminPersonDeletionEligibility,
  verifyAdminPeopleBulk,
} from "../providers/people-admin";
import { jsonReasonFailure } from "../../shared/respond";
import { adminPeopleVerifySchema, adminPersonCreateSchema } from "../schemas";

const DELETE_PERSON_ERRORS = {
  person_not_found: { status: 404 as ContentfulStatusCode, error: "Person not found." },
  person_has_links: {
    status: 409 as ContentfulStatusCode,
    error:
      "Cannot delete this person while they have orders, event invites, or guest invite links.",
  },
} as const;

export function createPeopleControlRouter(): Hono {
  const control = new Hono();

  control.route(
    "/",
    actionProvider(
      [
        {
          method: "post",
          path: "/create",
          schema: adminPersonCreateSchema,
          handler: async (c) => {
            const body = adminPersonCreateSchema.assert(await c.req.json());
            const item = await createAdminPerson({
              givenName: body.givenName,
              familyName: body.familyName,
              email: body.email ?? null,
              phoneE164: body.phoneE164 ?? null,
              markVerified: body.markVerified ?? false,
            });
            return c.json({ item }, 201);
          },
        },
        {
          method: "post",
          path: "/verify",
          schema: adminPeopleVerifySchema,
          handler: async (c) => {
            const body = adminPeopleVerifySchema.assert(await c.req.json());
            const summary = await verifyAdminPeopleBulk(body.personIds);
            return c.json({ ok: true, meta: summary });
          },
        },
        {
          method: "get",
          path: "/:id/deletion-eligibility",
          handler: async (c) => {
            const eligibility = await getAdminPersonDeletionEligibility(
              c.req.param("id")!,
            );
            if (!eligibility) {
              return jsonReasonFailure(
                c,
                { reason: "person_not_found" },
                DELETE_PERSON_ERRORS,
              );
            }
            return c.json({ item: eligibility });
          },
        },
        {
          method: "delete",
          path: "/:id",
          handler: async (c) => {
            const res = await deleteAdminPerson(c.req.param("id")!);
            if (!res.ok) {
              return jsonReasonFailure(c, res, DELETE_PERSON_ERRORS);
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
