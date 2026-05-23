import { eventsService } from "../../../services/events.service";
import {
  eventInviteesService,
  eventInviteesTable,
} from "../../../services/event-invitees.service";
import { listAdminEventInvitees } from "../providers/invitees-list";
import { defineAdminResource } from "../resource";

export const eventInviteesResource = defineAdminResource({
  table: eventInviteesTable,
  list: listAdminEventInvitees,
  opts: {
    operations: ["list", "read", "update"],
    list: {
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
      read: [
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
