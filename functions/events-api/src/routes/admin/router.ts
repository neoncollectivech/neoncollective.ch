import { composeResourceRouter, createResourceRouter, ResourceApiError } from "@neon/resource-api";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AdminEnv } from "../../auth/require-admin-session";
import { requireAdminSession } from "../../auth/require-admin-session";
import { mapCtx } from "../../services/base/map-ctx";
import { InviteMechanismDisabledError } from "../../services/events.service";
import { createEventsControlRouter } from "./control/events";
import { createOrdersControlRouter } from "./control/orders";
import { createPeopleControlRouter } from "./control/people";
import { adminRoute } from "./mount";
import { createInviteesProvider } from "./providers/invitees";
import { admissionsResource } from "./resources/admissions";
import { eventInviteesResource } from "./resources/event-invitees";
import { eventTiersResource } from "./resources/event-tiers";
import { events, orders, people } from "./resources/index";
import { inviteLinksResource } from "./resources/invite-links";
import { inviteRedemptionsResource } from "./resources/invite-redemptions";
import { orderTiersResource } from "./resources/order-tiers";

const adminAuth = [requireAdminSession];
const resourceRouterOpts = { mapCtx };

function mountResource(
  admin: Hono<AdminEnv>,
  path: string,
  resource: Parameters<typeof composeResourceRouter>[0]["resource"],
  control?: Hono,
): void {
  const router = control
    ? composeResourceRouter({ resource, control, mapCtx })
    : createResourceRouter(resource, resourceRouterOpts);
  adminRoute(admin, path, router, ...adminAuth);
}

export function createAdminRouter(): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();

  admin.onError((err, c) => {
    if (err instanceof InviteMechanismDisabledError) {
      return c.json({ error: err.message }, 403);
    }
    if (err instanceof ResourceApiError) {
      return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  });

  mountResource(admin, "/events", events, createEventsControlRouter());
  mountResource(admin, "/people", people, createPeopleControlRouter());
  mountResource(admin, "/orders", orders, createOrdersControlRouter());
  mountResource(admin, "/event-invitees", eventInviteesResource);
  mountResource(admin, "/event-tiers", eventTiersResource);
  mountResource(admin, "/order-tiers", orderTiersResource);
  mountResource(admin, "/admissions", admissionsResource);
  mountResource(admin, "/invite-redemptions", inviteRedemptionsResource);
  mountResource(admin, "/invite-links", inviteLinksResource);

  const eventScoped = new Hono();
  eventScoped.route("/", createInviteesProvider());
  adminRoute(admin, "/events/:eventId", eventScoped, ...adminAuth);

  return admin;
}
