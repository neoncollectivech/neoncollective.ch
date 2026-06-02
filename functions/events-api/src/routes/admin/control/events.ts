import { actionProvider, ResourceApiError } from "@neon/resource-api";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  isAllowedEventImageContentType,
  MAX_EVENT_IMAGE_BYTES,
} from "../../../config/event-images";
import {
  buildEventImageStorageKey,
  buildPublicUrl,
  createPresignedPutUrl,
  deleteObject,
  isR2Configured,
} from "../../../helpers/r2-storage";
import { admissionsService } from "../../../services/admissions.service";
import { eventImagesService } from "../../../services/event-images.service";
import { eventTiersService } from "../../../services/event-tiers.service";
import { eventsService } from "../../../services/events.service";
import { orderTiersService } from "../../../services/order-tiers.service";
import {
  adminEventImageCreateSchema,
  adminEventImageFocalSchema,
  adminEventImagePresignSchema,
  adminEventImageReorderSchema,
  adminEventTiersPutSchema,
} from "../schemas";
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
  exclusive_required: {
    status: 400 as ContentfulStatusCode,
    error: "At least one exclusive tier is required for each event.",
  },
} as const;

function serializeEventImage(image: Awaited<
  ReturnType<typeof eventImagesService.listByEventId>
>[number]) {
  return {
    id: image.id,
    eventId: image.eventId,
    storageKey: image.storageKey,
    url: image.url,
    contentType: image.contentType,
    byteSize: image.byteSize,
    sortOrder: image.sortOrder,
    altText: image.altText,
    focalX: image.focalX,
    focalY: image.focalY,
    createdAt: image.createdAt.toISOString(),
  };
}

function mapResourceApiError(c: { json: (body: unknown, status: number) => Response }, err: unknown) {
  if (err instanceof ResourceApiError) {
    return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
  }
  throw err;
}

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
        {
          method: "get",
          path: "/:id/images",
          handler: async (c) => {
            const eventId = c.req.param("id")!;
            const ev = await eventsService.get(eventId);
            if (!ev) {
              return c.json({ error: "Event not found." }, 404);
            }
            const images = await eventImagesService.listByEventId(eventId);
            return c.json({ images: images.map(serializeEventImage) });
          },
        },
        {
          method: "post",
          path: "/:id/images/presign",
          schema: adminEventImagePresignSchema,
          handler: async (c) => {
            if (!isR2Configured()) {
              return c.json({ error: "Image storage is not configured." }, 503);
            }
            const eventId = c.req.param("id")!;
            const ev = await eventsService.get(eventId);
            if (!ev) {
              return c.json({ error: "Event not found." }, 404);
            }
            const body = adminEventImagePresignSchema.assert(await c.req.json());
            if (!isAllowedEventImageContentType(body.contentType)) {
              return c.json({ error: "Unsupported image content type." }, 400);
            }
            if (body.byteSize <= 0 || body.byteSize > MAX_EVENT_IMAGE_BYTES) {
              return c.json({ error: "Image exceeds the maximum allowed size." }, 400);
            }
            const storageKey = buildEventImageStorageKey(eventId, body.contentType);
            const uploadUrl = await createPresignedPutUrl({
              storageKey,
              contentType: body.contentType,
              byteSize: body.byteSize,
            });
            return c.json({
              uploadUrl,
              storageKey,
              url: buildPublicUrl(storageKey),
              contentType: body.contentType,
            });
          },
        },
        {
          method: "post",
          path: "/:id/images",
          schema: adminEventImageCreateSchema,
          handler: async (c) => {
            const eventId = c.req.param("id")!;
            const ev = await eventsService.get(eventId);
            if (!ev) {
              return c.json({ error: "Event not found." }, 404);
            }
            const body = adminEventImageCreateSchema.assert(await c.req.json());
            try {
              const image = await eventImagesService.createForEvent(eventId, body);
              return c.json(serializeEventImage(image), 201);
            } catch (err) {
              return mapResourceApiError(c, err);
            }
          },
        },
        {
          method: "patch",
          path: "/:id/images/:imageId",
          schema: adminEventImageFocalSchema,
          handler: async (c) => {
            const eventId = c.req.param("id")!;
            const imageId = c.req.param("imageId")!;
            const ev = await eventsService.get(eventId);
            if (!ev) {
              return c.json({ error: "Event not found." }, 404);
            }
            const body = adminEventImageFocalSchema.assert(await c.req.json());
            if (
              (body.focalX === null) !== (body.focalY === null)
            ) {
              return c.json(
                { error: "focalX and focalY must both be set or both be null." },
                400,
              );
            }
            try {
              const focal =
                body.focalX === null || body.focalY === null
                  ? null
                  : { x: body.focalX, y: body.focalY };
              const image = await eventImagesService.updateFocalForEvent(
                eventId,
                imageId,
                focal,
              );
              return c.json(serializeEventImage(image));
            } catch (err) {
              return mapResourceApiError(c, err);
            }
          },
        },
        {
          method: "put",
          path: "/:id/images/reorder",
          schema: adminEventImageReorderSchema,
          handler: async (c) => {
            const eventId = c.req.param("id")!;
            const ev = await eventsService.get(eventId);
            if (!ev) {
              return c.json({ error: "Event not found." }, 404);
            }
            const body = adminEventImageReorderSchema.assert(await c.req.json());
            try {
              const images = await eventImagesService.reorderForEvent(
                eventId,
                body.imageIds,
              );
              return c.json({ images: images.map(serializeEventImage) });
            } catch (err) {
              return mapResourceApiError(c, err);
            }
          },
        },
        {
          method: "delete",
          path: "/:id/images/:imageId",
          handler: async (c) => {
            const eventId = c.req.param("id")!;
            const imageId = c.req.param("imageId")!;
            const ev = await eventsService.get(eventId);
            if (!ev) {
              return c.json({ error: "Event not found." }, 404);
            }
            try {
              const removed = await eventImagesService.deleteForEvent(
                eventId,
                imageId,
              );
              await deleteObject(removed.storageKey);
              return c.body(null, 204);
            } catch (err) {
              return mapResourceApiError(c, err);
            }
          },
        },
      ],
      [],
    ),
  );

  return control;
}
