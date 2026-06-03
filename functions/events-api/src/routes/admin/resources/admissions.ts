import {
  admissionsAdminListResourceMeta,
  admissionsAdminListTable,
  admissionsAdminListViewService,
} from "../../../services/admissions-admin-list.view.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const admissionsResource = defineResource({
  table: admissionsAdminListTable,
  meta: admissionsAdminListResourceMeta,
  service: tableServiceToBridge(admissionsAdminListViewService),
  opts: {
    operations: ["list"],
  },
});
