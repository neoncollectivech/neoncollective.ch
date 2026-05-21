import { actionProvider } from "@neon/admin-crud";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { admissionsService } from "../../../services/admissions.service";
import { eventTiersService } from "../../../services/event-tiers.service";
import { eventsService, eventsTable } from "../../../services/events.service";
import { orderTiersService } from "../../../services/order-tiers.service";
import { getAdminEventDetail } from "../providers/events-admin";
import { defineAdminResource } from "../resource";
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

export const events = defineAdminResource({
  table: eventsTable,
  detail: async (id) => getAdminEventDetail(id),
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
