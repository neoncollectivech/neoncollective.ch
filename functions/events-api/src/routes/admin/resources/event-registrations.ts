import { defineResource, tableServiceToBridge } from "@neon/resource-api";

import {
  eventRegistrationsResourceMeta,
  eventRegistrationsService,
  eventRegistrationsTable,
} from "../../../services/event-registrations.service";

export const eventRegistrationsResource = defineResource({
  table: eventRegistrationsTable,
  meta: eventRegistrationsResourceMeta,
  service: tableServiceToBridge(eventRegistrationsService),
  opts: { operations: ["list", "read"] },
});
