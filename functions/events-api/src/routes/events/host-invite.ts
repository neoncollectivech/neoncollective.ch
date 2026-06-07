import { Hono } from "hono";

import type { AppEnv } from "../../auth/env";
import { authFactory } from "../../auth/factory";
import { requireParticipantPerson } from "../../auth/middleware/assert";
import { eventsService } from "../../services/events.service";
import {
  ensureHostInviteForParticipant,
  regenerateHostInviteForParticipant,
} from "../shared/invite-links-orchestration";
import { databaseUnavailableResponse, requireDatabase } from "../shared/guards";

export function createHostInviteRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post(
    "/events/:slug/host-invite/ensure",
    ...authFactory.createHandlers(requireParticipantPerson, async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const session = c.var.participantSession;
      if (!session?.personId) {
        return c.json({ error: "Sign in required." }, 401);
      }
      const slug = c.req.param("slug")!;
      const ev = await eventsService.getPublishedBySlug(slug);
      if (!ev || ev.accessMode !== "invite_only") {
        return c.json({ error: "Event not found." }, 404);
      }
      const result = await ensureHostInviteForParticipant({
        eventId: ev.id,
        personId: session.personId,
      });
      if (!result.ok) {
        return c.json({ error: "Not eligible to share guest invites." }, 403);
      }
      return c.json({
        token: result.token,
        created: result.created,
        remaining: result.remaining,
        conversions: result.conversions,
      });
    }),
  );

  router.post(
    "/events/:slug/host-invite/regenerate",
    ...authFactory.createHandlers(requireParticipantPerson, async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const session = c.var.participantSession;
      if (!session?.personId) {
        return c.json({ error: "Sign in required." }, 401);
      }
      const slug = c.req.param("slug")!;
      const ev = await eventsService.getPublishedBySlug(slug);
      if (!ev || ev.accessMode !== "invite_only") {
        return c.json({ error: "Event not found." }, 404);
      }
      const result = await regenerateHostInviteForParticipant({
        eventId: ev.id,
        personId: session.personId,
      });
      if (!result.ok) {
        return c.json({ error: "Not eligible to share guest invites." }, 403);
      }
      return c.json({
        token: result.token,
        remaining: result.remaining,
        conversions: result.conversions,
      });
    }),
  );

  return router;
}
