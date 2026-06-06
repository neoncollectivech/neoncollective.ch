import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AppEnv } from "../../auth/env";
import { authFactory } from "../../auth/factory";
import { eventApiKeyBearerAuth } from "../../auth/middleware/event-api-key";
import { apiKeyGrantsEvent } from "../../auth/resolvers/event-api-key";
import {
  posGuestResolveSchema,
  posPricingPreviewSchema,
  posReaderPairSchema,
  posSaleCreateSchema,
} from "../../schemas";
import { isSumUpConfigured } from "../../config/sumup";
import {
  deleteSumUpReader,
  getSumUpPosConfig,
  listSumUpReaders,
  pairSumUpReader,
} from "../../helpers/sumup";
import { getPosCatalog } from "./catalog";
import { eventsService } from "../../services/events.service";
import { cancelPosSale } from "./cancel-sale";
import { createPosSale } from "./create-sale";
import { previewPosPricing } from "./pricing-preview";
import { resolvePosGuest } from "./resolve-pos-guest";
import { getPosSaleStatus } from "./sale-status";

const POS_ERRORS = {
  event_not_found: { status: 404 as ContentfulStatusCode, error: "Event not found." },
  sumup_not_configured: {
    status: 503 as ContentfulStatusCode,
    error: "SumUp is not configured on the server.",
  },
  contact_required: { status: 400, error: "Guest contact details are required." },
  identity_conflict: {
    status: 409,
    error: "Contact details conflict with another profile.",
  },
  admission_not_found: {
    status: 404,
    error: "Admission not found or invalid.",
  },
  tier_required: { status: 400, error: "Select a contribution tier." },
  tiers_required: { status: 400, error: "Select at least one tier." },
  unknown_tier: { status: 400, error: "Unknown or inactive tier." },
  invalid_exclusive_tier: { status: 400, error: "Invalid contribution tier." },
  invalid_addon_tier: { status: 400, error: "Invalid add-on tier." },
  already_registered: {
    status: 409,
    error: "Guest already has a confirmed place for this event.",
  },
  addon_only_requires_exclusive: {
    status: 409,
    error: "Guest needs an existing admission before buying add-ons only.",
  },
  addon_already_purchased: {
    status: 409,
    error: "This add-on is already part of the guest contribution.",
  },
  event_sold_out: { status: 409, error: "This event is sold out." },
  tier_sold_out: { status: 409, error: "Not enough places remaining for this tier." },
  mixed_currency: { status: 400, error: "Selected tiers use different currencies." },
  reader_checkout_failed: {
    status: 502,
    error: "Could not start payment on the Solo reader.",
  },
  reader_offline: {
    status: 503,
    error: "The Solo reader is offline.",
  },
  checkout_failed: { status: 500, error: "Checkout failed." },
  sale_not_found: { status: 404, error: "Sale not found." },
  sale_not_cancellable: { status: 409, error: "Sale cannot be cancelled." },
} as const;

function resolvePosEventId(c: { req: { query: (k: string) => string | undefined }; var: AppEnv["Variables"] }): string | null {
  const fromQuery = c.req.query("eventId")?.trim();
  if (fromQuery) {
    return fromQuery;
  }
  const apiKey = c.var.eventApiKey;
  if (apiKey?.eventId) {
    return apiKey.eventId;
  }
  return null;
}

function assertPosEventAccess(
  c: { var: AppEnv["Variables"] },
  eventId: string,
): boolean {
  const apiKey = c.var.eventApiKey;
  if (!apiKey) {
    return false;
  }
  return apiKeyGrantsEvent(apiKey, eventId);
}

export function createPosRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get(
    "/pos/readers",
    ...authFactory.createHandlers(eventApiKeyBearerAuth, async (c) => {
      if (!isSumUpConfigured()) {
        return c.json({ error: POS_ERRORS.sumup_not_configured.error }, 503);
      }
      try {
        const readers = await listSumUpReaders();
        return c.json({ readers, sumup: getSumUpPosConfig() });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to list readers.";
        return c.json({ error: msg }, 502);
      }
    }),
  );

  router.post(
    "/pos/readers/pair",
    ...authFactory.createHandlers(
      eventApiKeyBearerAuth,
      arktypeValidator("json", posReaderPairSchema),
      async (c) => {
        if (!isSumUpConfigured()) {
          return c.json({ error: POS_ERRORS.sumup_not_configured.error }, 503);
        }
        const body = c.req.valid("json");
        try {
          const paired = await pairSumUpReader({
            pairingCode: body.pairingCode,
            name: body.name,
          });
          const readers = await listSumUpReaders();
          const reader = readers.find((item) => item.id === paired.id) ?? {
            id: paired.id,
            name: paired.name,
            status: paired.status,
            deviceIdentifier: paired.deviceIdentifier,
            connectionStatus: null,
            online: false,
          };
          return c.json({ reader });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to pair reader.";
          return c.json({ error: msg }, 502);
        }
      },
    ),
  );

  router.delete(
    "/pos/readers/:readerId",
    ...authFactory.createHandlers(eventApiKeyBearerAuth, async (c) => {
      if (!isSumUpConfigured()) {
        return c.json({ error: POS_ERRORS.sumup_not_configured.error }, 503);
      }
      const readerId = c.req.param("readerId")?.trim();
      if (!readerId) {
        return c.json({ error: "Reader id is required." }, 400);
      }
      try {
        await deleteSumUpReader(readerId);
        return c.json({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to delete reader.";
        return c.json({ error: msg }, 502);
      }
    }),
  );

  router.get(
    "/pos/catalog",
    ...authFactory.createHandlers(eventApiKeyBearerAuth, async (c) => {
      const eventId = resolvePosEventId(c);
      if (!eventId || !assertPosEventAccess(c, eventId)) {
        return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
      }
      const catalog = await getPosCatalog(eventId);
      if (!catalog) {
        return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
      }
      return c.json(catalog);
    }),
  );

  router.post(
    "/pos/guest/resolve",
    ...authFactory.createHandlers(
      eventApiKeyBearerAuth,
      arktypeValidator("json", posGuestResolveSchema),
      async (c) => {
        const eventId = resolvePosEventId(c);
        if (!eventId || !assertPosEventAccess(c, eventId)) {
          return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
        }
        const body = c.req.valid("json");
        const ev = await eventsService.get(eventId);
        if (!ev || ev.status !== "published") {
          return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
        }
        const result = await resolvePosGuest({
          eventId,
          eventQuota: ev.eventQuota,
          credential: body.credential,
          email: body.email,
          phoneE164: body.phoneE164,
          givenName: body.givenName,
          familyName: body.familyName,
        });
        if (!result.ok) {
          if (result.reason === "admission_not_found") {
            return c.json({ error: POS_ERRORS.admission_not_found.error }, 404);
          }
          if (result.reason === "identity_conflict") {
            return c.json({ error: POS_ERRORS.identity_conflict.error }, 409);
          }
          return c.json({ error: POS_ERRORS.contact_required.error }, 400);
        }
        return c.json(result.guest);
      },
    ),
  );

  router.post(
    "/pos/pricing-preview",
    ...authFactory.createHandlers(
      eventApiKeyBearerAuth,
      arktypeValidator("json", posPricingPreviewSchema),
      async (c) => {
        const eventId = resolvePosEventId(c);
        if (!eventId || !assertPosEventAccess(c, eventId)) {
          return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
        }
        const body = c.req.valid("json");
        const result = await previewPosPricing({
          eventId,
          exclusiveTierId: body.exclusiveTierId,
          addonTierIds: body.addonTierIds,
        });
        if (!result.ok) {
          const mapped = POS_ERRORS[result.reason as keyof typeof POS_ERRORS];
          if (mapped) {
            return c.json({ error: mapped.error }, mapped.status);
          }
          return c.json({ error: "Invalid pricing request." }, 400);
        }
        return c.json(result);
      },
    ),
  );

  router.post(
    "/pos/sale",
    ...authFactory.createHandlers(
      eventApiKeyBearerAuth,
      arktypeValidator("json", posSaleCreateSchema),
      async (c) => {
        const eventId = resolvePosEventId(c);
        if (!eventId || !assertPosEventAccess(c, eventId)) {
          return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
        }
        const apiKey = c.var.eventApiKey!;
        const body = c.req.valid("json");
        const result = await createPosSale({
          eventId,
          soldBy: `api-key:${apiKey.label}`,
          readerId: body.readerId,
          locale: body.locale,
          exclusiveTierId: body.exclusiveTierId,
          addonTierIds: body.addonTierIds,
          credential: body.credential,
          email: body.email,
          phoneE164: body.phoneE164,
          givenName: body.givenName,
          familyName: body.familyName,
        });
        if (!result.ok) {
          const err = POS_ERRORS[result.reason];
          const message =
            result.reason === "tier_sold_out" && result.tierName
              ? `Not enough places remaining for ${result.tierName}.`
              : err.error;
          return c.json({ error: message }, err.status);
        }
        return c.json(result);
      },
    ),
  );

  router.post(
    "/pos/sale/:orderId/cancel",
    ...authFactory.createHandlers(eventApiKeyBearerAuth, async (c) => {
      const eventId = resolvePosEventId(c);
      if (!eventId || !assertPosEventAccess(c, eventId)) {
        return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
      }
      const orderId = c.req.param("orderId")?.trim();
      if (!orderId) {
        return c.json({ error: POS_ERRORS.sale_not_found.error }, 404);
      }
      const result = await cancelPosSale(orderId, eventId);
      if (result === "not_found") {
        return c.json({ error: POS_ERRORS.sale_not_found.error }, 404);
      }
      if (result === "not_cancellable") {
        return c.json({ error: POS_ERRORS.sale_not_cancellable.error }, 409);
      }
      return c.json({ ok: true });
    }),
  );

  router.get(
    "/pos/sale/:orderId",
    ...authFactory.createHandlers(eventApiKeyBearerAuth, async (c) => {
      const eventId = resolvePosEventId(c);
      if (!eventId || !assertPosEventAccess(c, eventId)) {
        return c.json({ error: POS_ERRORS.event_not_found.error }, 404);
      }
      const orderId = c.req.param("orderId")?.trim();
      if (!orderId) {
        return c.json({ error: POS_ERRORS.sale_not_found.error }, 404);
      }
      const status = await getPosSaleStatus(orderId, eventId);
      if (!status) {
        return c.json({ error: POS_ERRORS.sale_not_found.error }, 404);
      }
      return c.json(status);
    }),
  );

  return router;
}
