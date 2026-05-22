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
  eventInviteesAdminSortFields,
  eventInviteesEventIdColumn,
  eventInviteesService,
  eventInviteesTable,
  parseInviteeOrderStatusFilter,
} from "../../../services/event-invitees.service";

const ORDER_STATUS_FILTER_KEY = "orderStatus";

const inviteesListMeta = introspectPgTable(eventInviteesTable, {
  list: {
    sortFields: { ...eventInviteesAdminSortFields },
  },
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

function queryParam(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }

  return undefined;
}

function parseInviteesAdminListQuery(
  raw: Record<string, string | string[] | undefined>,
) {
  const orderStatus = queryParam(raw[ORDER_STATUS_FILTER_KEY]);
  const listRaw = { ...raw };
  delete listRaw[ORDER_STATUS_FILTER_KEY];

  const parsed = parseListQuery(listRaw);

  return { parsed, orderStatus };
}

export async function listAdminEventInvitees(
  c: AdminCrudContext,
): Promise<ListProviderResult> {
  const raw = c.req.query() as Record<string, string | string[] | undefined>;
  const { parsed, orderStatus: orderStatusRaw } = parseInviteesAdminListQuery(raw);
  const filters = { ...parsed.filters } as Record<string, string | string[] | undefined>;

  const eventId = queryParam(filters.eventId)?.trim();
  const orderStatus = parseInviteeOrderStatusFilter(orderStatusRaw);
  const orderStatusWhere =
    eventId && orderStatus
      ? buildInviteeOrderStatusWhere(eventId, orderStatus)
      : undefined;

  const scope = resolveAdminListScope(
    {
      query: {
        limit: parsed.limit,
        skip: parsed.skip,
        sort: parsed.sort,
        q: parsed.q,
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
