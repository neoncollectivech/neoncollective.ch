import { defineAdminResource } from "../resource";
import type { AdminServiceBridge } from "../service-bridge";
import { peopleService, peopleTable } from "../../../services/people.service";
import {
  getAdminPersonDetail,
  verifyAdminPeopleBulk,
} from "../providers/people-admin";
import { adminPeopleVerifySchema } from "../schemas";

const peopleBridge: AdminServiceBridge = {
  list: (query, ctx) =>
    peopleService.list(query as import("@neon/admin-crud").ListQuery<Record<string, never>>, ctx),
  count: (query, ctx) =>
    peopleService.count(query as import("@neon/admin-crud").ListQuery<Record<string, never>>, ctx),
  get: (id, ctx) => peopleService.get(id, ctx),
  getDetail: (id) => getAdminPersonDetail(id),
  update: (id, data, ctx) => peopleService.update(id, data, ctx),
  updateBulk: (updates, ctx) => peopleService.updateBulk(updates, ctx),
  parseListQuery: (raw) => peopleService.parseListQuery(raw),
};

export const people = defineAdminResource({
  table: peopleTable,
  service: peopleBridge,
  bulk: { update: true },
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
