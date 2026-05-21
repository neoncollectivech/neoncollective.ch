import { defineAdminResource } from "../resource";
import { peopleTable } from "../../../services/people.service";
import {
  getAdminPersonDetail,
  verifyAdminPeopleBulk,
} from "../providers/people-admin";
import { adminPeopleVerifySchema } from "../schemas";

export const people = defineAdminResource({
  table: peopleTable,
  detail: async (id) => getAdminPersonDetail(id),
  opts: {
    operations: ["list", "update"],
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
