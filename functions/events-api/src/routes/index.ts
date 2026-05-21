import { Hono } from "hono";

import { createAdminRouter } from "./admin/router";
import { createCheckInRouter } from "./check-in";
import { createCheckoutRouter } from "./checkout";
import { createEventsRouter } from "./events";
import { createHealthRouter } from "./health";
import { createInvitesRouter } from "./invites";
import { createRegistrationsRouter } from "./registrations";
import { createWebhooksRouter } from "./webhooks";

export function createAppRouter(): Hono {
  const app = new Hono();

  app.route("/", createHealthRouter());
  app.route("/", createEventsRouter());
  app.route("/", createInvitesRouter());
  app.route("/", createCheckoutRouter());
  app.route("/", createWebhooksRouter());
  app.route("/", createRegistrationsRouter());
  app.route("/", createCheckInRouter());
  app.route("/admin", createAdminRouter());

  return app;
}
