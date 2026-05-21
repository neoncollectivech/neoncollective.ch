import { AdminApiError } from "@neon/admin-crud";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AdminEnv } from "../../auth/require-admin-session";
import { requireAdminSession } from "../../auth/require-admin-session";
import { InviteMechanismDisabledError } from "../../services/events.service";
import { createCrudRouter } from "./create-crud-router";
import { adminRoute } from "./mount";
import { createInviteesProvider } from "./providers/invitees";
import { events, orders, people } from "./resources/index";
import { createEventInviteesCrudRouter } from "./resources/event-invitees";

const adminAuth = [requireAdminSession];

export function createAdminRouter(): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();

  admin.onError((err, c) => {
    if (err instanceof InviteMechanismDisabledError) {
      return c.json({ error: err.message }, 403);
    }
    if (err instanceof AdminApiError) {
      return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  });

  adminRoute(admin, "/events", createCrudRouter(events), ...adminAuth);
  adminRoute(admin, "/people", createCrudRouter(people), ...adminAuth);
  adminRoute(admin, "/orders", createCrudRouter(orders), ...adminAuth);

  const eventScoped = new Hono();
  eventScoped.route("/invitees", createEventInviteesCrudRouter());
  eventScoped.route("/", createInviteesProvider());
  adminRoute(admin, "/events/:eventId", eventScoped, ...adminAuth);

  return admin;
}
