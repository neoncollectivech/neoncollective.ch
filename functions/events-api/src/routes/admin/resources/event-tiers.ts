import {
  eventTiersResourceMeta,
  eventTiersService,
  eventTiersTable,
} from "../../../services/event-tiers.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const eventTiersResource = defineResource({
  table: eventTiersTable,
  meta: eventTiersResourceMeta,
  service: tableServiceToBridge(eventTiersService),
  opts: {
    operations: ["list", "read"],
  },
});
