import type { OrderRow } from "@/lib/admin-api";

import { listOrders } from "@/lib/admin-api";
import { eventOrderPath } from "@/lib/event-workspace-paths";
import { toIdInParam } from "@/lib/admin-list";

import { defineAdminFkService } from "./types";

function orderLookupKeyByPersonId(row: unknown): string {
  return String((row as OrderRow).personId);
}

export const orderFkService = defineAdminFkService({
  id: "order",
  defaultIdKey: "personId",
  batchIdFromRow: (row) => row.personId,
  buildListParams: (ids, scope) => {
    if (!scope?.eventId) {
      return { limit: "1", skip: "0" };
    }

    return {
      eventId: scope.eventId,
      limit: String(Math.max(ids.length, 1)),
      skip: "0",
      sort: "-createdAt",
      ...(ids.length > 0 ? { personId_in: toIdInParam(ids) } : {}),
    };
  },
  list: listOrders,
  lookupKeyFromRow: orderLookupKeyByPersonId,
  presentation: "badge",
  href: (_personId, row) => {
    const order = row as OrderRow | undefined;

    if (!order?.id || !order.eventId) {
      return undefined;
    }

    return eventOrderPath(order.eventId, order.id);
  },
});
