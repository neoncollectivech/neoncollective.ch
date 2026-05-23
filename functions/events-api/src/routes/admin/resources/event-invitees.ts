import {
  eventInviteesResourceMeta,
  eventInviteesService,
  eventInviteesTable,
} from "../../../services/event-invitees.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const eventInviteesResource = defineResource({
  table: eventInviteesTable,
  meta: eventInviteesResourceMeta,
  service: tableServiceToBridge(eventInviteesService),
  opts: {
    operations: ["list", "read", "update"],
  },
});
