import { actionProvider } from "@neon/resource-api";
import { Hono } from "hono";

import { InviteMechanismDisabledError } from "../../../services/events.service";
import {
  InviteeUpsertError,
  deleteEventInvitee,
  ensureInviteeHostLink,
  regenerateInviteeHostLink,
  revokeEventInvitee,
  upsertInviteesForEvent,
} from "./invitees-admin";
import {
  InviteLinkDeleteError,
  InviteLinkUpdateError,
  deleteHostInviteLink,
  rotateHostInviteLinkToken,
  updateHostInviteLinkMaxRedemptions,
} from "../../shared/invite-links-orchestration";
import { exportEventInviteesCsv } from "./invitees-export";
import { inviteLinksService } from "../../../services/invite-links.service";
import { adminInviteesUpsertSchema } from "../../../schemas";
import {
  adminInviteLinkMaxRedemptionsSchema,
  adminRegenerateInviteLinkSchema,
} from "../schemas";

export function createInviteesProvider(): Hono {
  const router = new Hono();
  const noMiddleware: never[] = [];

  router.route(
    "/invitees",
    actionProvider(
      [
        {
          method: "get",
          path: "/export",
          handler: exportEventInviteesCsv,
        },
        {
          method: "post",
          path: "/",
          schema: adminInviteesUpsertSchema,
          handler: async (c) => {
            const eventId = c.req.param("eventId")!;
            const body = adminInviteesUpsertSchema.assert(await c.req.json());
            try {
              const summary = await upsertInviteesForEvent(
                eventId,
                body.invitees,
              );
              return c.json({
                results: summary.results,
                meta: {
                  created: summary.created,
                  skipped: summary.skipped,
                  invalid: summary.invalid,
                },
              });
            } catch (e) {
              if (e instanceof InviteMechanismDisabledError) {
                return c.json({ error: e.message }, 403);
              }
              if (e instanceof InviteeUpsertError) {
                const status = e.code === "contact_required" ? 400 : 409;
                return c.json({ error: e.message }, status);
              }
              throw e;
            }
          },
        },
        {
          method: "post",
          path: "/:inviteeId/revoke",
          handler: async (c) => {
            const ok = await revokeEventInvitee(
              c.req.param("eventId"),
              c.req.param("inviteeId"),
            );
            if (!ok) {
              return c.json({ error: "Invitee not found." }, 404);
            }
            return c.json({ ok: true });
          },
        },
        {
          method: "delete",
          path: "/:inviteeId",
          handler: async (c) => {
            const ok = await deleteEventInvitee(
              c.req.param("eventId"),
              c.req.param("inviteeId"),
            );
            if (!ok) {
              return c.json({ error: "Invitee not found." }, 404);
            }
            return c.body(null, 204);
          },
        },
        {
          method: "post",
          path: "/:inviteeId/ensure-link",
          handler: async (c) => {
            const result = await ensureInviteeHostLink(
              c.req.param("eventId"),
              c.req.param("inviteeId"),
            );
            if (!result.ok) {
              if (result.reason === "profile_pending") {
                return c.json(
                  {
                    error:
                      "Invitee has no linked person yet — they must complete their profile first.",
                  },
                  400,
                );
              }
              if (result.reason === "not_eligible_host") {
                return c.json(
                  { error: "Only first-degree invitees can have a host share link." },
                  400,
                );
              }
              return c.json({ error: "Invitee not found." }, 404);
            }
            return c.json({
              inviteToken: result.inviteToken,
              created: result.created,
            });
          },
        },
        {
          method: "post",
          path: "/:inviteeId/regenerate-link",
          schema: adminRegenerateInviteLinkSchema,
          handler: async (c) => {
            const body = adminRegenerateInviteLinkSchema.assert(
              await c.req.json().catch(() => ({})),
            );
            const result = await regenerateInviteeHostLink(
              c.req.param("eventId"),
              c.req.param("inviteeId"),
              body.maxRedemptions,
            );
            if (!result.ok) {
              if (result.reason === "profile_pending") {
                return c.json(
                  {
                    error:
                      "Invitee has no linked person yet — they must complete their profile first.",
                  },
                  400,
                );
              }
              if (result.reason === "not_eligible_host") {
                return c.json(
                  { error: "Only first-degree invitees can have a host share link." },
                  400,
                );
              }
              return c.json({ error: "Invitee not found." }, 404);
            }
            return c.json({ inviteToken: result.inviteToken });
          },
        },
      ],
      noMiddleware,
    ),
  );

  router.route(
    "/invite-links",
    actionProvider(
      [
        {
          method: "patch",
          path: "/:linkId",
          schema: adminInviteLinkMaxRedemptionsSchema,
          handler: async (c) => {
            const body = adminInviteLinkMaxRedemptionsSchema.assert(await c.req.json());
            try {
              const item = await updateHostInviteLinkMaxRedemptions(
                c.req.param("eventId"),
                c.req.param("linkId"),
                body.maxRedemptions,
              );
              return c.json({ item });
            } catch (e) {
              if (e instanceof InviteLinkUpdateError) {
                if (e.code === "not_found") {
                  return c.json({ error: e.message }, 404);
                }
                return c.json({ error: e.message }, 400);
              }
              throw e;
            }
          },
        },
        {
          method: "delete",
          path: "/:linkId",
          handler: async (c) => {
            try {
              const item = await deleteHostInviteLink(
                c.req.param("eventId"),
                c.req.param("linkId"),
              );
              return c.json({ item });
            } catch (e) {
              if (e instanceof InviteLinkDeleteError) {
                if (e.code === "not_found") {
                  return c.json({ error: e.message }, 404);
                }
                return c.json({ error: e.message }, 400);
              }
              throw e;
            }
          },
        },
        {
          method: "get",
          path: "/:linkId/token",
          handler: async (c) => {
            const token = await inviteLinksService.getTokenForLink(
              c.req.param("eventId"),
              c.req.param("linkId"),
            );
            if (!token) {
              return c.json({ error: "Invite link not found." }, 404);
            }
            return c.json({ inviteToken: token });
          },
        },
        {
          method: "post",
          path: "/:linkId/rotate-token",
          handler: async (c) => {
            const token = await rotateHostInviteLinkToken(
              c.req.param("eventId"),
              c.req.param("linkId"),
            );
            if (!token) {
              return c.json({ error: "Invite link not found." }, 404);
            }
            return c.json({ inviteToken: token });
          },
        },
      ],
      noMiddleware,
    ),
  );

  return router;
}
