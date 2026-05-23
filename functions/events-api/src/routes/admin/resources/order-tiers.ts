import { orderTiersTable } from "../../../services/order-tiers.service";
import { defineAdminResource } from "../resource";

export const orderTiersResource = defineAdminResource({
  table: orderTiersTable,
  opts: {
    operations: ["list"],
    list: {
      defaultSort: "eventTierId",
    },
    fields: {
      list: ["id", "orderId", "eventTierId", "unitPriceCents"],
    },
  },
});
