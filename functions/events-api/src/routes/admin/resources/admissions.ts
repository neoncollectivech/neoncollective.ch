import {
  admissionsResourceMeta,
  admissionsService,
  admissionsTable,
} from "../../../services/admissions.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const admissionsResource = defineResource({
  table: admissionsTable,
  meta: admissionsResourceMeta,
  service: tableServiceToBridge(admissionsService),
  opts: {
    operations: ["list"],
  },
});
