import {
  filterable,
  introspectPgTable,
  listMetaFromScope,
  parseListQuery,
  resolveAdminListScope,
  runAdminListFromScope,
  type ListProviderResult,
} from "@neon/admin-crud";
import type { AdminCrudContext } from "@neon/admin-crud";

import { getAdminCrudDb } from "../../../services/admin/crud-mount";
import {
  buildInviteeOrderStatusWhere,
  eventInviteesEventIdColumn,
  eventInviteesService,
  eventInviteesTable,
  parseInviteeOrderStatusFilter,
} from "../../../services/event-invitees.service";

const ORDER_STATUS_FILTER_KEY = "orderStatus";

const inviteesListMeta = introspectPgTable(eventInviteesTable, {
  fields: {
    list: [
      "id",
      "eventId",
      "personId",
      "inviterId",
      "email",
      "phone",
      "notes",
      "revokedAt",
      "createdAt",
    ],
  },
});

function projectListRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of inviteesListMeta.project.list) {
    out[key] = row[key];
  }

  return out;
}

export async function listAdminEventInvitees(
  c: AdminCrudContext,
): Promise<ListProviderResult> {
  const raw = c.req.query() as Record<string, string | string[] | undefined>;
  const parsed = parseListQuery(raw);
  const filters = { ...parsed.filters } as Record<string, string | string[] | undefined>;

  const orderStatusRaw = filters[ORDER_STATUS_FILTER_KEY];
  delete filters[ORDER_STATUS_FILTER_KEY];

  const eventIdRaw = filters.eventId;
  const eventId =
    typeof eventIdRaw === "string" && eventIdRaw.trim() ? eventIdRaw.trim() : undefined;

  const orderStatus = parseInviteeOrderStatusFilter(orderStatusRaw);
  const orderStatusWhere =
    eventId && orderStatus
      ? buildInviteeOrderStatusWhere(eventId, orderStatus)
      : undefined;

  const scope = resolveAdminListScope(
    {
      query: {
        ...parsed,
        filters: filters as Record<string, never>,
      },
      filterable: [filterable("eventId", eventInviteesEventIdColumn)],
      sortFields: inviteesListMeta.sortFields,
      defaultSort: eventInviteesService.listDefaultSort(),
      extraWhere: orderStatusWhere,
    },
    inviteesListMeta.idColumn,
  );

  const db = getAdminCrudDb();
  const { rows, total } = await runAdminListFromScope({
    db,
    table: eventInviteesTable,
    scope,
  });

  return {
    items: rows.map(projectListRow),
    meta: listMetaFromScope(scope, total),
  };
}
