import { defineResource, tableServiceToBridge } from "@neon/resource-api";

import {
  ordersResourceMeta,
  ordersService,
  ordersTable,
} from "../../../services/orders.service";

export const orders = defineResource({
  table: ordersTable,
  meta: ordersResourceMeta,
  service: tableServiceToBridge(ordersService),
  opts: {
    operations: ["list", "read", "delete"],
  },
});
