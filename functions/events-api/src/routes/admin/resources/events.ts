import { actionProvider } from "@neon/admin-crud";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { admissionsService } from "../../../services/admissions.service";
import { eventTiersService } from "../../../services/event-tiers.service";
import { eventsService, eventsTable } from "../../../services/events.service";
import { orderTiersService } from "../../../services/order-tiers.service";
import { getAdminEventDetail } from "../providers/events-admin";
import { defineAdminResource } from "../resource";
import type { AdminServiceBridge } from "../service-bridge";
import { adminEventTiersPutSchema } from "../schemas";
import { jsonReasonFailure } from "../../shared/respond";

const REPLACE_TIERS_ERRORS = {
  event_not_found: { status: 404 as ContentfulStatusCode, error: "Event not found." },
  unknown_tier_id: { status: 400 as ContentfulStatusCode, error: "Unknown tier id for this event." },
  tier_in_use: {
    status: 409 as ContentfulStatusCode,
    error: "Tier is used by existing orders. Deactivate it instead.",
  },
} as const;

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
          const ev = await eventsService.get(eventId);
          if (!ev) {
            return jsonReasonFailure(
              c,
              { reason: "event_not_found" },
              REPLACE_TIERS_ERRORS,
            );
          }
          const res = await eventTiersService.replaceTiers(eventId, body.tiers, {
            canRemoveTier: async (tierId, tx) => {
              const orderRefs = await orderTiersService.countByEventTierId(tierId, tx);
              const admissionRefs = await admissionsService.countByEventTierId(tierId, tx);
              return orderRefs + admissionRefs === 0;
            },
          });
          if (!res.ok) {
            return jsonReasonFailure(
              c,
              { reason: res.reason, message: res.message },
              REPLACE_TIERS_ERRORS,
            );
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
  getDetail: (id) => getAdminEventDetail(id),
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
