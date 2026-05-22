import { listPeople } from "@/lib/admin-api";
import { toIdInParam } from "@/lib/admin-list";

import { defineAdminFkService } from "./types";

function lookupKeyById(row: unknown): string {
  return String((row as { id: string }).id);
}

export const personFkService = defineAdminFkService({
  id: "person",
  defaultIdKey: "personId",
  batchIdFromRow: (row) => row.personId,
  buildListParams: (ids) => ({
    limit: String(ids.length || 1),
    skip: "0",
    ...(ids.length > 0 ? { id_in: toIdInParam(ids) } : {}),
  }),
  list: listPeople,
  lookupKeyFromRow: lookupKeyById,
  presentation: "link",
  href: (id) => `/people/${id}`,
});
