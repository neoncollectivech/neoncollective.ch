import { authFactory } from "../auth/factory";
import { loadAdminSession, loadEventApiKey, loadParticipantSession } from "../auth/middleware/loaders";
import { createAdminRouter } from "./admin/router";
import { createAdmissionJwksRouter } from "./admission-jwks";
import { createCheckInRouter } from "./check-in";
import { createCheckoutRouter } from "./checkout";
import { createEventsRouter } from "./events";
import { createHostInviteRouter } from "./events/host-invite";
import { createHealthRouter } from "./health";
import { createInvitesRouter } from "./invites";
import { createRegistrationsRouter } from "./registrations";
import { createPosRouter } from "./pos";
import { createSumUpWebhookRouter } from "./webhooks/sumup";
import { createWebhooksRouter } from "./webhooks";

export function createAppRouter() {
  const app = authFactory.createApp();

  app.route("/", createHealthRouter());
  app.route("/", createInvitesRouter());

  const eventsShell = authFactory.createApp();
  eventsShell.use("*", loadParticipantSession);
  eventsShell.use("*", loadEventApiKey);
  eventsShell.route("/", createEventsRouter());
  eventsShell.route("/", createHostInviteRouter());
  app.route("/", eventsShell);

  const checkoutShell = authFactory.createApp();
  checkoutShell.use("*", loadParticipantSession);
  checkoutShell.route("/", createCheckoutRouter());
  app.route("/", checkoutShell);

  const registrationsShell = authFactory.createApp();
  registrationsShell.use("*", loadParticipantSession);
  registrationsShell.route("/", createRegistrationsRouter());
  app.route("/", registrationsShell);

  app.route("/", createWebhooksRouter());
  app.route("/", createSumUpWebhookRouter());
  app.route("/", createPosRouter());
  app.route("/", createCheckInRouter());
  app.route("/", createAdmissionJwksRouter());

  const adminShell = authFactory.createApp();
  adminShell.use("*", loadAdminSession);
  adminShell.route("/admin", createAdminRouter());
  app.route("/", adminShell);

  return app;
}
