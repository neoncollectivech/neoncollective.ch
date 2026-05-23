import { inviteRedemptionsTable } from "../../../services/invite-redemptions.service";
import { defineAdminResource } from "../resource";

export const inviteRedemptionsResource = defineAdminResource({
  table: inviteRedemptionsTable,
  opts: {
    operations: ["list"],
    list: {
      defaultSort: "-createdAt",
    },
    fields: {
      list: ["id", "orderId", "inviteLinkId", "createdAt"],
    },
  },
});
