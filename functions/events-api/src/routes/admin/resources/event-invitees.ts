import { defineFilterable, filterable } from "@neon/admin-crud";

import { eventInvitees } from "../../../db/schema";
import { eventsService } from "../../../services/events.service";
import {
  eventInviteesService,
  eventInviteesTable,
} from "../../../services/event-invitees.service";
import { getAdminInviteeDetail } from "../providers/invitees-admin";
import { defineAdminResource } from "../resource";

const eventInviteesFilterable = defineFilterable([
  filterable("eventId", eventInvitees.eventId),
] as const);

const inviteesFilterFields = Object.fromEntries(
  eventInviteesFilterable.map((f) => [f.name, f.column]),
) as Record<string, import("drizzle-orm/pg-core").PgColumn>;

export const eventInviteesResource = defineAdminResource({
  table: eventInviteesTable,
  detail: async (id) => getAdminInviteeDetail(id),
  opts: {
    operations: ["list", "update"],
    list: {
      filterFields: inviteesFilterFields,
      defaultSort: "-createdAt",
    },
    fields: {
      list: [
        "id",
        "eventId",
        "personId",
        "inviterId",
        "email",
        "phone",
        "notes",
        "revokedAt",
        "createdAt",
      ],
      update: ["notes"],
    },
    hooks: {
      beforeUpdate: async (id, data) => {
        const row = await eventInviteesService.get(id);
        if (row) {
          await eventsService.requireInviteOnly(row.eventId);
        }
        return data;
      },
    },
  },
});
