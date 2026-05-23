import {
  inviteLinksResourceMeta,
  inviteLinksService,
  inviteLinksTable,
} from "../../../services/invite-links.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const inviteLinksResource = defineResource({
  table: inviteLinksTable,
  meta: inviteLinksResourceMeta,
  service: tableServiceToBridge(inviteLinksService),
  opts: {
    operations: ["list", "read"],
  },
});
