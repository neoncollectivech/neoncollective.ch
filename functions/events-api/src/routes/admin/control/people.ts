import { actionProvider } from "@neon/resource-api";
import { Hono } from "hono";

import { verifyAdminPeopleBulk } from "../providers/people-admin";
import { adminPeopleVerifySchema } from "../schemas";

export function createPeopleControlRouter(): Hono {
  const control = new Hono();

  control.route(
    "/",
    actionProvider(
      [
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
