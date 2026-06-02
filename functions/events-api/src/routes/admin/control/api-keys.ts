import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Hono } from "hono";

import type { AppEnv } from "../../../auth/env";
import { apiKeysService } from "../../../services/api-keys.service";
import { eventsService } from "../../../services/events.service";
import { adminApiKeyCreateSchema } from "../schemas";
import { jsonReasonFailure } from "../../shared/respond";

const API_KEY_ERRORS = {
  event_not_found: { status: 404 as ContentfulStatusCode, error: "Event not found." },
  invalid_event_id: {
    status: 400 as ContentfulStatusCode,
    error: "Invalid event id.",
  },
} as const;

function serializeApiKey(row: Awaited<ReturnType<typeof apiKeysService.listAll>>[number]) {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdByEmail: row.createdByEmail,
  };
}

function adminEmail(c: Context<AppEnv>): string | null {
  return c.var.adminSession?.user.email ?? null;
}

export async function listAllApiKeysHandler(c: Context<AppEnv>): Promise<Response> {
  const eventIdFilter = c.req.query("eventId");
  const items =
    eventIdFilter === "global" || eventIdFilter === "null"
      ? await apiKeysService.listAll(null)
      : eventIdFilter
        ? await apiKeysService.listAll(eventIdFilter)
        : await apiKeysService.listAll();
  return c.json({ items: items.map(serializeApiKey) });
}

export async function createApiKeyHandler(c: Context<AppEnv>): Promise<Response> {
  const body = adminApiKeyCreateSchema.assert(await c.req.json());
  if (body.eventId) {
    const ev = await eventsService.get(body.eventId);
    if (!ev) {
      return jsonReasonFailure(c, { reason: "event_not_found" }, API_KEY_ERRORS);
    }
  }
  const { row, rawToken } = await apiKeysService.mint({
    label: body.label,
    eventId: body.eventId ?? null,
    createdByEmail: adminEmail(c),
  });
  return c.json(
    {
      item: serializeApiKey(row),
      token: rawToken,
    },
    201,
  );
}

export async function listEventApiKeysHandler(c: Context<AppEnv>): Promise<Response> {
  const eventId = c.req.param("id")!;
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, API_KEY_ERRORS);
  }
  const items = await apiKeysService.listKeysForEvent(eventId);
  return c.json({ items: items.map(serializeApiKey) });
}

export async function createEventApiKeyHandler(c: Context<AppEnv>): Promise<Response> {
  const eventId = c.req.param("id")!;
  const body = adminApiKeyCreateSchema.assert(await c.req.json());
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, API_KEY_ERRORS);
  }
  const { row, rawToken } = await apiKeysService.mint({
    label: body.label,
    eventId,
    createdByEmail: adminEmail(c),
  });
  return c.json(
    {
      item: serializeApiKey(row),
      token: rawToken,
    },
    201,
  );
}

export async function revokeApiKeyHandler(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param("id")!;
  await apiKeysService.revoke(id);
  return c.body(null, 204);
}

export function createApiKeysControlRouter(): Hono {
  const router = new Hono();
  router.get("/", listAllApiKeysHandler);
  router.post("/", createApiKeyHandler);
  router.post("/:id/revoke", revokeApiKeyHandler);
  return router;
}
