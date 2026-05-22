import { eventsService } from "../../../services/events.service";
import {
  eventInviteesService,
  eventInviteesEventIdColumn,
  eventInviteesTable,
} from "../../../services/event-invitees.service";
import { getAdminInviteeDetail } from "../providers/invitees-admin";
import { listAdminEventInvitees } from "../providers/invitees-list";
import { defineAdminResource } from "../resource";

const inviteesFilterFields: Record<string, import("drizzle-orm/pg-core").PgColumn> = {
  eventId: eventInviteesEventIdColumn,
};

export const eventInviteesResource = defineAdminResource({
  table: eventInviteesTable,
  list: listAdminEventInvitees,
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
