import type {
  AdminListRequestParams,
  EventRow,
  OrderRow,
  PersonRow,
} from "@/lib/admin-api";

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

export type ForeignKeyLookupRow = EventRow | PersonRow | OrderRow;

export type AdminFkServiceDefinition = {
  readonly id: string;
  readonly defaultIdKey: "eventId" | "personId";
  batchIdFromRow: (row: ForeignKeySourceRow) => string | null | undefined;
  buildListParams: (
    ids: string[],
    scope?: ForeignKeyScope,
  ) => AdminListRequestParams;
  list: (params: AdminListRequestParams) => Promise<{ items: unknown[] }>;
  lookupKeyFromRow: (row: unknown) => string;
  presentation: ForeignKeyPresentation;
  href: (lookupId: string, row: unknown) => string | undefined;
};

export function defineAdminFkService(
  def: AdminFkServiceDefinition,
): AdminFkServiceDefinition {
  return def;
}

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

export function collectBatchIdsForFk<TRow extends ForeignKeySourceRow>(
  rows: readonly TRow[],
  fk: AdminFkServiceDefinition,
  idKey?: keyof TRow & string,
): string[] {
  const raw = rows.map((row) => {
    if (idKey && idKey in row) {
      const value = row[idKey as keyof TRow];

      return typeof value === "string" ? value : null;
    }

    return fk.batchIdFromRow(row);
  });

  return [...new Set(raw.filter((id): id is string => Boolean(id)))].sort();
}

export function toForeignKeyLookupMap(
  fk: AdminFkServiceDefinition,
  items: unknown[],
): Map<string, ForeignKeyLookupRow> {
  const map = new Map<string, ForeignKeyLookupRow>();

  for (const item of items) {
    const key = fk.lookupKeyFromRow(item);

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
