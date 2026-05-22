import { listEvents } from "@/lib/admin-api";
import { toIdInParam } from "@/lib/admin-list";

import { defineAdminFkService } from "./types";

function lookupKeyById(row: unknown): string {
  return String((row as { id: string }).id);
}

export const eventFkService = defineAdminFkService({
  id: "event",
  defaultIdKey: "eventId",
  batchIdFromRow: (row) => row.eventId,
  buildListParams: (ids) => ({
    limit: String(ids.length || 1),
    skip: "0",
    ...(ids.length > 0 ? { id_in: toIdInParam(ids) } : {}),
  }),
  list: listEvents,
  lookupKeyFromRow: lookupKeyById,
  presentation: "link",
  href: (id) => `/events/${id}`,
});
