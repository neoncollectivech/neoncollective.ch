import { inviteLinksTable } from "../../../services/invite-links.service";
import { defineAdminResource } from "../resource";

export const inviteLinksResource = defineAdminResource({
  table: inviteLinksTable,
  opts: {
    operations: ["list", "read"],
    list: {
      defaultSort: "-createdAt",
    },
    exclude: {
      list: ["tokenHash"],
      read: ["tokenHash"],
    },
    fields: {
      list: [
        "id",
        "eventId",
        "inviterId",
        "maxRedemptions",
        "token",
        "createdAt",
        "rotatedAt",
      ],
      read: [
        "id",
        "eventId",
        "inviterId",
        "maxRedemptions",
        "token",
        "createdAt",
        "rotatedAt",
      ],
    },
  },
});
