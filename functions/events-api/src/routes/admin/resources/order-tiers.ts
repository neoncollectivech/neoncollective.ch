import {
  orderTiersResourceMeta,
  orderTiersService,
  orderTiersTable,
} from "../../../services/order-tiers.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const orderTiersResource = defineResource({
  table: orderTiersTable,
  meta: orderTiersResourceMeta,
  service: tableServiceToBridge(orderTiersService),
  opts: {
    operations: ["list"],
  },
});
