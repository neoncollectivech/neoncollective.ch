import { admissionsTable } from "../../../services/admissions.service";
import { defineAdminResource } from "../resource";

export const admissionsResource = defineAdminResource({
  table: admissionsTable,
  opts: {
    operations: ["list"],
    fields: {
      list: [
        "id",
        "orderId",
        "eventId",
        "checkedInAt",
        "revokedAt",
        "createdAt",
      ],
    },
  },
});
