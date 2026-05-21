import { parseListQuery } from "@neon/admin-crud";
import { Hono } from "hono";

import { eventInvitees } from "../../db/schema";
import { requireInviteOnlyEvent } from "../../services/event-read";
import { eventInviteesService } from "../../services/event-invitees.service";
import { createCrudRouter } from "../create-crud-router";
import { defineAdminResource } from "../resource";
import type { AdminServiceBridge } from "../service-bridge";

const inviteesBridge: AdminServiceBridge = {
  list: (query, ctx) =>
    eventInviteesService.list(
      query as import("@neon/admin-crud").ListQuery<Record<string, never>>,
      ctx,
    ),
  count: (query, ctx) =>
    eventInviteesService.count(
      query as import("@neon/admin-crud").ListQuery<Record<string, never>>,
      ctx,
    ),
  update: async (id, data, ctx) => {
    const eventId = ctx.parent?.value ?? ctx.hono?.req.param("eventId");
    if (eventId) {
      await requireInviteOnlyEvent(eventId);
    }
    return eventInviteesService.update(id, data, ctx);
  },
  parseListQuery: (raw) => parseListQuery(raw),
};

export const eventInviteesAdmin = defineAdminResource({
  table: eventInvitees,
  service: inviteesBridge,
  opts: {
    operations: ["update"],
    parent: { param: "eventId", column: eventInvitees.eventId },
    fields: {
      update: ["notes"],
    },
  },
});

export function createEventInviteesCrudRouter(): Hono {
  return createCrudRouter(eventInviteesAdmin);
}
