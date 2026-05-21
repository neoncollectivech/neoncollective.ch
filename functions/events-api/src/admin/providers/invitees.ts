import { actionProvider, detailProvider, listProvider } from "@neon/admin-crud";
import { Hono } from "hono";

import {
  InviteMechanismDisabledError,
  InviteeUpsertError,
  ensureInviteLink,
  regenerateInviteLink,
  revokeInvitee,
  upsertInviteesForEvent,
} from "../../services/admin-invitees";
import {
  InviteLinkDeleteError,
  InviteLinkUpdateError,
  deleteInviteLink,
  updateInviteLinkMaxRedemptions,
} from "../../services/admin-invite-links";
import { parseListQuery } from "@neon/admin-crud";
import { eventInvitees } from "../../db/schema";
import { getAdminInviteeDetail } from "../../services/admin/invitees-read";
import { mapCtx } from "../../services/base/map-ctx";
import { eventInviteesService } from "../../services/event-invitees.service";
import { adminInviteesUpsertSchema } from "../../schemas";
import {
  adminInviteLinkMaxRedemptionsSchema,
  adminRegenerateInviteLinkSchema,
} from "../schemas";

export function createInviteesProvider(): Hono {
  const router = new Hono();
  const noMiddleware: never[] = [];

  router.route(
    "/invitees",
    listProvider(async (c) => {
      const raw = c.req.query() as Record<string, string | string[] | undefined>;
      const query = parseListQuery(raw);
      return eventInviteesService.list(
        query,
        mapCtx(c, { param: "eventId", column: eventInvitees.eventId }),
      );
    }, noMiddleware),
  );

  router.route(
    "/invitees",
    actionProvider(
      [
        {
          method: "post",
          path: "/",
          schema: adminInviteesUpsertSchema,
          handler: async (c) => {
            const eventId = c.req.param("eventId")!;
            const body = adminInviteesUpsertSchema.assert(await c.req.json());
            try {
              const summary = await upsertInviteesForEvent(eventId, body.invitees);
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
            const ok = await revokeInvitee(c.req.param("eventId"), c.req.param("inviteeId"));
            if (!ok) {
              return c.json({ error: "Invitee not found." }, 404);
            }
            return c.json({ ok: true });
          },
        },
        {
          method: "post",
          path: "/:inviteeId/ensure-link",
          handler: async (c) => {
            const result = await ensureInviteLink(
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
            return c.json({ inviteToken: result.inviteToken });
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
            const result = await regenerateInviteLink(
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
    "/invitees",
    detailProvider(
      (id, c) => getAdminInviteeDetail(c.req.param("eventId"), id),
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
              const item = await updateInviteLinkMaxRedemptions(
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
              const item = await deleteInviteLink(
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
      ],
      noMiddleware,
    ),
  );

  return router;
}
