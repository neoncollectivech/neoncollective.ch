import {
  filterable,
  introspectPgTable,
  parseListQuery,
  resolveAdminListScope,
  type ResolvedListScope,
} from "@neon/admin-crud";

import {
  buildInviteeOrderStatusWhere,
  eventInviteesAdminSortFields,
  eventInviteesEventIdColumn,
  eventInviteesService,
  eventInviteesTable,
  parseInviteeOrderStatusFilter,
} from "../../../services/event-invitees.service";

export const ORDER_STATUS_FILTER_KEY = "orderStatus";

export const inviteesListMeta = introspectPgTable(eventInviteesTable, {
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

export function projectInviteeListRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of inviteesListMeta.project.list) {
    out[key] = row[key];
  }

  return out;
}

export function queryParam(
  raw: string | string[] | undefined,
): string | undefined {
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }

  return undefined;
}

export function parseInviteesAdminListQuery(
  raw: Record<string, string | string[] | undefined>,
) {
  const orderStatus = queryParam(raw[ORDER_STATUS_FILTER_KEY]);
  const listRaw = { ...raw };
  delete listRaw[ORDER_STATUS_FILTER_KEY];

  const parsed = parseListQuery(listRaw);

  return { parsed, orderStatus };
}

export type ResolvedInviteesAdminListScope = {
  scope: ResolvedListScope;
  eventId: string | undefined;
  parsed: ReturnType<typeof parseListQuery>;
};

export function resolveInviteesAdminListScope(
  raw: Record<string, string | string[] | undefined>,
  options?: { eventId?: string },
): ResolvedInviteesAdminListScope {
  const { parsed, orderStatus: orderStatusRaw } = parseInviteesAdminListQuery(raw);
  const filters = { ...parsed.filters } as Record<
    string,
    string | string[] | undefined
  >;

  if (options?.eventId) {
    filters.eventId = options.eventId;
  }

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

  return { scope, eventId, parsed };
}
