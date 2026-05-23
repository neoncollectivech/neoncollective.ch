import { defineAdminResource } from "../resource";
import { peopleTable } from "../../../services/people.service";
import { verifyAdminPeopleBulk } from "../providers/people-admin";
import { adminPeopleVerifySchema } from "../schemas";

export const people = defineAdminResource({
  table: peopleTable,
  opts: {
    operations: ["list", "read", "update"],
    exclude: {
      update: ["phone", "emailVerifiedAt", "phoneVerifiedAt", "updatedAt"],
    },
    schemas: {
      update: {
        phoneE164: "string | null",
        email: "string.email | null",
      },
    },
    fields: {
      list: [
        "id",
        "givenName",
        "familyName",
        "email",
        "phone",
        "emailVerifiedAt",
        "phoneVerifiedAt",
        "createdAt",
      ],
      read: [
        "id",
        "givenName",
        "familyName",
        "email",
        "phone",
        "emailVerifiedAt",
        "phoneVerifiedAt",
        "createdAt",
        "updatedAt",
      ],
    },
  },
  actions: [
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
});
