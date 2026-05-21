import { actionProvider } from "@neon/admin-crud";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { events as eventsTable } from "../../db/schema";
import { replaceEventTiers } from "../../services/admin/event-tiers";
import { eventsService } from "../../services/events.service";
import { defineAdminResource } from "../resource";
import type { AdminServiceBridge } from "../service-bridge";
import { adminEventTiersPutSchema } from "../schemas";

function eventTiersExtension(): Hono {
  return actionProvider(
    [
      {
        method: "put",
        path: "/:id/tiers",
        schema: adminEventTiersPutSchema,
        handler: async (c) => {
          const eventId = c.req.param("id")!;
          const body = adminEventTiersPutSchema.assert(await c.req.json());
          const res = await replaceEventTiers(eventId, body.tiers);
          if ("error" in res) {
            return c.json({ error: res.error }, res.status as ContentfulStatusCode);
          }
          return c.json({ tiers: res.tiers });
        },
      },
    ],
    [],
  );
}

const eventsBridge: AdminServiceBridge = {
  list: (query, ctx) => eventsService.list(query, ctx),
  count: (query, ctx) => eventsService.count(query, ctx),
  get: (id, ctx) => eventsService.get(id, ctx),
  getDetail: (id, ctx) => eventsService.getDetail(id, ctx),
  create: (data, ctx) => eventsService.create(data, ctx),
  createBulk: (items, ctx) => eventsService.createBulk(items, ctx),
  update: (id, data, ctx) => eventsService.update(id, data, ctx),
  updateBulk: (updates, ctx) => eventsService.updateBulk(updates, ctx),
  delete: (id, ctx) => eventsService.delete(id, ctx),
  parseListQuery: (raw) =>
    eventsService.parseListQuery(raw) as import("@neon/admin-crud").ListQuery<
      Record<string, unknown>
    >,
};

export const events = defineAdminResource({
  table: eventsTable,
  service: eventsBridge,
  opts: {
    operations: ["list", "create", "update"],
    schemas: {
      jsonbStringArrays: ["imageUrls"],
    },
    exclude: {
      create: ["status"],
    },
    fields: {
      list: [
        "id",
        "slug",
        "title",
        "status",
        "accessMode",
        "startsAt",
        "createdAt",
      ],
    },
  },
  extensions: () => [eventTiersExtension()],
});
