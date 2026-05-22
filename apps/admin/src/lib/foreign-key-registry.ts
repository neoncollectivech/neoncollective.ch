import type {
  AdminListRequestParams,
  EventRow,
  OrderRow,
  PersonRow,
} from "@/lib/admin-api";

import { listEvents, listOrders, listPeople } from "@/lib/admin-api";
import { toIdInParam } from "@/lib/admin-list";

export type ForeignKeyService = "event" | "person" | "order";

export type ForeignKeyScope = {
  eventId: string;
};

export type ForeignKeyPresentation = "link" | "badge";

export type ForeignKeyRowValue = string | null | undefined;

/** Minimal row shape for collecting FK ids from admin list rows. */
export type ForeignKeySourceRow = {
  eventId?: ForeignKeyRowValue;
  personId?: ForeignKeyRowValue;
};

type ForeignKeyRegistryEntry<TRow extends ForeignKeySourceRow> = {
  batchIdFromRow: (row: TRow) => string | null | undefined;
  buildListParams: (
    ids: string[],
    scope?: ForeignKeyScope,
  ) => AdminListRequestParams;
  list: (params: AdminListRequestParams) => Promise<{ items: unknown[] }>;
  lookupKeyFromRow: (row: unknown) => string;
  presentation: ForeignKeyPresentation;
  href: (lookupId: string, row: unknown) => string | undefined;
};

function lookupKeyById(row: unknown): string {
  return String((row as { id: string }).id);
}

function orderLookupKeyByPersonId(row: unknown): string {
  return String((row as OrderRow).personId);
}

export const FK_SERVICE_REGISTRY = {
  event: {
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
  },
  person: {
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
  },
  order: {
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
      const orderId = (row as OrderRow | undefined)?.id;

      return orderId ? `/orders/${orderId}` : undefined;
    },
  },
} satisfies Record<
  ForeignKeyService,
  ForeignKeyRegistryEntry<ForeignKeySourceRow>
>;

export type ForeignKeyLookupRow = EventRow | PersonRow | OrderRow;

export function formatForeignKeyDisplay(
  row: ForeignKeyLookupRow | undefined,
  foreignDisplayField: string | readonly string[],
): string | undefined {
  if (!row) {
    return undefined;
  }
  const fields = Array.isArray(foreignDisplayField)
    ? foreignDisplayField
    : [foreignDisplayField];
  const parts = fields
    .map((field) => {
      const value = (row as Record<string, unknown>)[field];

      return typeof value === "string" ? value.trim() : "";
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function collectBatchIds<TRow extends ForeignKeySourceRow>(
  rows: readonly TRow[],
  service: ForeignKeyService,
): string[] {
  const entry = FK_SERVICE_REGISTRY[service];
  const raw = rows.map((row) => entry.batchIdFromRow(row));

  return [...new Set(raw.filter((id): id is string => Boolean(id)))].sort();
}

export function toForeignKeyLookupMap(
  service: ForeignKeyService,
  items: unknown[],
): Map<string, ForeignKeyLookupRow> {
  const entry = FK_SERVICE_REGISTRY[service];
  const map = new Map<string, ForeignKeyLookupRow>();

  for (const item of items) {
    const key = entry.lookupKeyFromRow(item);

    if (!key || map.has(key)) {
      continue;
    }
    map.set(key, item as ForeignKeyLookupRow);
  }

  return map;
}

export function listParamsToQueryKey(
  params: AdminListRequestParams,
): Record<string, string> {
  const out: Record<string, string> = {
    limit: params.limit,
    skip: params.skip,
  };

  if (params.q) {
    out.q = params.q;
  }
  if (params.eventId) {
    out.eventId = params.eventId;
  }
  if (params.id_in) {
    out.id_in = params.id_in;
  }
  if (params.personId_in) {
    out.personId_in = params.personId_in;
  }
  if (params.sort) {
    out.sort = params.sort;
  }

  return out;
}
