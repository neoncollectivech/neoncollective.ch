import { defineResource, tableServiceToBridge } from "@neon/resource-api";

import {
  eventsResourceMeta,
  eventsService,
  eventsTable,
} from "../../../services/events.service";

export const events = defineResource({
  table: eventsTable,
  meta: eventsResourceMeta,
  service: tableServiceToBridge(eventsService),
  opts: {
    operations: ["list", "read", "create", "update"],
    schemas: {
      jsonbStringArrays: ["imageUrls"],
    },
  },
});
