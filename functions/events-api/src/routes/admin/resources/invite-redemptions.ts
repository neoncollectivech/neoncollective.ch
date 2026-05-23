import {
  inviteRedemptionsResourceMeta,
  inviteRedemptionsService,
  inviteRedemptionsTable,
} from "../../../services/invite-redemptions.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const inviteRedemptionsResource = defineResource({
  table: inviteRedemptionsTable,
  meta: inviteRedemptionsResourceMeta,
  service: tableServiceToBridge(inviteRedemptionsService),
  opts: {
    operations: ["list"],
  },
});
