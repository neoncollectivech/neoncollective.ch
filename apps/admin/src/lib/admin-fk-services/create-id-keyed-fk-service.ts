import type { AdminListRequestParams } from "@/lib/admin-api";

import { toIdInParam } from "@/lib/admin-list";

import { defineAdminFkService } from "./types";

function lookupKeyById(row: unknown): string {
  return String((row as { id: string }).id);
}

export function createIdKeyedFkService(config: {
  id: string;
  defaultIdKey: "eventId" | "personId";
  batchIdFromRow: (row: {
    eventId?: string | null;
    personId?: string | null;
  }) => string | null | undefined;
  list: (params: AdminListRequestParams) => Promise<{ items: unknown[] }>;
  href: (id: string) => string;
}) {
  return defineAdminFkService({
    id: config.id,
    defaultIdKey: config.defaultIdKey,
    batchIdFromRow: config.batchIdFromRow,
    buildListParams: (ids) => ({
      limit: String(ids.length || 1),
      skip: "0",
      ...(ids.length > 0 ? { id_in: toIdInParam(ids) } : {}),
    }),
    list: config.list,
    lookupKeyFromRow: lookupKeyById,
    presentation: "link",
    href: (id) => config.href(id),
  });
}
