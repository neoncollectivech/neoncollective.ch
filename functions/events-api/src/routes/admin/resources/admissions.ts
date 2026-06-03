import {
  admissionsAdminListResourceMeta,
  admissionsAdminListTable,
  admissionsAdminListViewService,
} from "../../../services/admissions-admin-list.view.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

import { createAdmissionsControlRouter } from "../control/admissions";

export const admissionsResource = defineResource({
  table: admissionsAdminListTable,
  meta: admissionsAdminListResourceMeta,
  service: tableServiceToBridge(admissionsAdminListViewService),
  opts: {
    operations: ["list", "read"],
  },
});

export const admissionsResourceWithControl = {
  resource: admissionsResource,
  control: createAdmissionsControlRouter(),
};
