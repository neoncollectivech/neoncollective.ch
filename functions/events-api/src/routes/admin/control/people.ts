import { actionProvider } from "@neon/resource-api";
import { Hono } from "hono";

import { createAdminPerson, verifyAdminPeopleBulk } from "../providers/people-admin";
import { adminPeopleVerifySchema, adminPersonCreateSchema } from "../schemas";

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
      ],
      [],
    ),
  );

  return control;
}
