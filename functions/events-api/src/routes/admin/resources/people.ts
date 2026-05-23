import { defineResource, tableServiceToBridge } from "@neon/resource-api";

import { peopleResourceMeta, peopleService, peopleTable } from "../../../services/people.service";

export const people = defineResource({
  table: peopleTable,
  meta: peopleResourceMeta,
  service: tableServiceToBridge(peopleService),
  opts: {
    operations: ["list", "read", "update"],
    schemas: {
      update: {
        phoneE164: "string | null",
        email: "string.email | null",
      },
    },
  },
});
