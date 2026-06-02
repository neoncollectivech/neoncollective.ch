import { Hono } from "hono";

import type { AppEnv } from "../auth/env";
import { authFactory } from "../auth/factory";
import type { EventApiKeyAuth } from "../auth/resolvers/event-api-key";
import { apiKeyGrantsEvent } from "../auth/resolvers/event-api-key";
import { eventApiKeyBearerAuth } from "../auth/middleware/event-api-key";
import { getPublishedEventAvailability } from "./events/availability";
import {
  getPublishedEventDetailForViewer,
  resolveInviteEventId,
} from "./events/read";
import { listPublishedCatalog } from "./events/catalog";
import { listPublicAdmissionsForEvent } from "./events/admissions";
import { eventsService } from "../services/events.service";
import { databaseUnavailableResponse, requireDatabase } from "./shared/guards";
import { parseListScopeQuery } from "./shared/list-scope";

function catalogParamsFromApiKey(
  apiKey: EventApiKeyAuth | null | undefined,
) {
  if (!apiKey) {
    return {};
  }
  if (apiKey.eventId === null) {
    return { apiKeyIsGlobal: true as const };
  }
  return { apiKeyEventId: apiKey.eventId };
}

export function createEventsRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/events", async (c) => {
    if (!requireDatabase(c)) {
      return c.json({ events: [] });
    }
    const session = c.var.participantSession ?? null;
    const apiKey = c.var.eventApiKey ?? null;
    const inviteQ = c.req.query("invite");
    const inviteEventId = await resolveInviteEventId({
      inviteToken: inviteQ,
      sessionInviteLinkId: session?.inviteLinkId,
    });
    const rows = await listPublishedCatalog({
      viewerPersonId: session?.personId ?? null,
      inviteEventId,
      ...catalogParamsFromApiKey(apiKey),
    });
    return c.json({
      events: rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        location: r.location,
        images: r.images,
        startsAt: r.startsAt?.toISOString() ?? null,
        inviteOnly: r.inviteOnly,
        registrationConfirmed: r.registrationConfirmed,
      })),
    });
  });

  router.get("/events/:slug/availability", async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const session = c.var.participantSession ?? null;
    const body = await getPublishedEventAvailability(c.req.param("slug"), {
      inviteToken: c.req.query("invite"),
      session,
      apiKey: c.var.eventApiKey ?? null,
    });

    if (!body) {
      return c.json({ error: "Event not found." }, 404);
    }

    return c.json(body);
  });

  router.get(
    "/events/:slug/admissions",
    ...authFactory.createHandlers(eventApiKeyBearerAuth, async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const slug = c.req.param("slug")!;
      const ev = await eventsService.getPublishedBySlug(slug);
      if (!ev || !apiKeyGrantsEvent(c.var.eventApiKey!, ev.id)) {
        return c.json({ error: "Event not found." }, 404);
      }
      const scope = parseListScopeQuery(c.req.query());
      const result = await listPublicAdmissionsForEvent(ev.id, scope);
      return c.json(result);
    }),
  );

  router.get("/events/:slug", async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const session = c.var.participantSession ?? null;
    const res = await getPublishedEventDetailForViewer({
      slug: c.req.param("slug"),
      inviteToken: c.req.query("invite"),
      session,
      apiKey: c.var.eventApiKey ?? null,
    });
    if (!res.ok) {
      return c.json({ error: "Event not found." }, 404);
    }
    return c.json(res.body);
  });

  return router;
}
