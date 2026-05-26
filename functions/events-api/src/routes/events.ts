import { Hono } from "hono";

import { getPublishedEventAvailability } from "./events/availability";
import {
  getPublishedEventDetailForViewer,
  resolveInviteEventId,
} from "./events/read";
import { listPublishedCatalog } from "./events/catalog";
import { resolveParticipantSessionFromCookie } from "./registrations/session";
import { databaseUnavailableResponse, requireDatabase } from "./shared/guards";

export function createEventsRouter(): Hono {
  const router = new Hono();

  router.get("/events", async (c) => {
    if (!requireDatabase(c)) {
      return c.json({ events: [] });
    }
    const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    const inviteQ = c.req.query("invite");
    const inviteEventId = await resolveInviteEventId({
      inviteToken: inviteQ,
      sessionInviteLinkId: session?.inviteLinkId,
    });
    const rows = await listPublishedCatalog({
      viewerPersonId: session?.personId ?? null,
      inviteEventId,
    });
    return c.json({
      events: rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        location: r.location,
        imageUrls: r.imageUrls,
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
    const body = await getPublishedEventAvailability(c.req.param("slug"));

    if (!body) {
      return c.json({ error: "Event not found." }, 404);
    }

    return c.json(body);
  });

  router.get("/events/:slug", async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    const res = await getPublishedEventDetailForViewer({
      slug: c.req.param("slug"),
      inviteToken: c.req.query("invite"),
      session,
    });
    if (!res.ok) {
      return c.json({ error: "Event not found." }, 404);
    }
    return c.json(res.body);
  });

  return router;
}
