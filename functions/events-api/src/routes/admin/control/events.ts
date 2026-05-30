import { actionProvider } from "@neon/resource-api";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { admissionsService } from "../../../services/admissions.service";
import { eventTiersService } from "../../../services/event-tiers.service";
import { eventsService } from "../../../services/events.service";
import { orderTiersService } from "../../../services/order-tiers.service";
import { adminEventTiersPutSchema } from "../schemas";
import {
  createEventPromotionCodeHandler,
  listEventPromotionCodesHandler,
  patchEventPromotionCodeHandler,
} from "./event-promotion-codes";
import { getEventSalesAnalyticsHandler } from "./event-sales-analytics";
import { jsonReasonFailure } from "../../shared/respond";

const REPLACE_TIERS_ERRORS = {
  event_not_found: { status: 404 as ContentfulStatusCode, error: "Event not found." },
  unknown_tier_id: { status: 400 as ContentfulStatusCode, error: "Unknown tier id for this event." },
  tier_in_use: {
    status: 409 as ContentfulStatusCode,
    error: "Tier is used by existing orders. Deactivate it instead.",
  },
} as const;

export function createEventsControlRouter(): Hono {
  const control = new Hono();

  control.route(
    "/",
    actionProvider(
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
        {
          method: "get",
          path: "/:id/promotion-codes",
          handler: listEventPromotionCodesHandler,
        },
        {
          method: "get",
          path: "/:id/sales-analytics",
          handler: getEventSalesAnalyticsHandler,
        },
        {
          method: "post",
          path: "/:id/promotion-codes",
          handler: createEventPromotionCodeHandler,
        },
        {
          method: "patch",
          path: "/:id/promotion-codes/:promotionCodeId",
          handler: patchEventPromotionCodeHandler,
        },
      ],
      [],
    ),
  );

  return control;
}
