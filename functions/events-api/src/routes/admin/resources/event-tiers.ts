import { eventTiersTable } from "../../../services/event-tiers.service";
import { listAdminEventTiers } from "../providers/event-tiers-list";
import { defineAdminResource } from "../resource";

const tierFields = [
  "id",
  "eventId",
  "name",
  "description",
  "priceCents",
  "currency",
  "quota",
  "sortOrder",
  "active",
  "selectionMode",
] as const;

export const eventTiersResource = defineAdminResource({
  table: eventTiersTable,
  list: listAdminEventTiers,
  opts: {
    operations: ["list", "read"],
    list: {
      defaultSort: "sortOrder",
    },
    fields: {
      list: [...tierFields],
      read: [...tierFields],
    },
  },
});
