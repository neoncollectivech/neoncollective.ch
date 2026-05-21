import { Hono } from "hono";

import { findInviteLinkByRawToken } from "./shared/invite-links-orchestration";
import { ordersService } from "../services/orders.service";
import { databaseUnavailableResponse, requireDatabase } from "./shared/guards";

export function createInvitesRouter(): Hono {
  const router = new Hono();

  router.get("/invites/resolve", async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const token = c.req.query("token");
    if (!token) {
      return c.json({ error: "Missing token." }, 400);
    }
    const row = await findInviteLinkByRawToken(token);
    if (!row || row.event.accessMode !== "invite_only") {
      return c.json({ error: "Invalid invite." }, 404);
    }
    const used = await ordersService.countPendingOrPaidForInviteLink(row.link.id);
    return c.json({
      eventSlug: row.event.slug,
      hostGivenName: row.inviter?.givenName?.trim() ?? "NEON",
      remainingRedemptions: Math.max(0, row.link.maxRedemptions - used),
      inviteOnly: true,
    });
  });

  return router;
}
