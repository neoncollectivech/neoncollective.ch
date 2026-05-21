import { parseListQuery } from "@neon/admin-crud";
import { Hono } from "hono";

import { eventsService } from "../../../services/events.service";
import {
  eventInviteesEventIdColumn,
  eventInviteesService,
  eventInviteesTable,
} from "../../../services/event-invitees.service";
import {
  countAdminEventInvitees,
  getAdminInviteeDetail,
  listAdminEventInvitees,
} from "../providers/invitees-admin";
import { createCrudRouter } from "../create-crud-router";
import { defineAdminResource } from "../resource";
import type { AdminServiceBridge } from "../service-bridge";

const inviteesBridge: AdminServiceBridge = {
  list: (query, ctx) =>
    listAdminEventInvitees(
      query as import("@neon/admin-crud").ListQuery<Record<string, never>>,
      ctx,
    ),
  count: (query, ctx) =>
    countAdminEventInvitees(
      query as import("@neon/admin-crud").ListQuery<Record<string, never>>,
      ctx,
    ),
  getDetail: (id, ctx) => getAdminInviteeDetail(id, ctx),
  update: async (id, data, ctx) => {
    const eventId = ctx.parent?.value ?? ctx.hono?.req.param("eventId");
    if (eventId) {
      await eventsService.requireInviteOnly(eventId);
    }
    return eventInviteesService.update(id, data, ctx);
  },
  parseListQuery: (raw) => parseListQuery(raw),
};

export const eventInviteesAdmin = defineAdminResource({
  table: eventInviteesTable,
  service: inviteesBridge,
  opts: {
    operations: ["update"],
    parent: { param: "eventId", column: eventInviteesEventIdColumn },
    fields: {
      update: ["notes"],
    },
  },
});

export function createEventInviteesCrudRouter(): Hono {
  return createCrudRouter(eventInviteesAdmin);
}
