import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { AdminFkServiceDefinition } from "@/lib/admin-fk-services";

export function extractFkServicesFromColumns<TRow>(
  columns: AdminColumnDef<TRow>[],
): AdminFkServiceDefinition[] {
  const seen = new Set<string>();
  const out: AdminFkServiceDefinition[] = [];

  for (const col of columns) {
    const fk = col.meta?.fk?.fk;

    if (!fk || seen.has(fk.id)) {
      continue;
    }
    seen.add(fk.id);
    out.push(fk);
  }

  return out;
}

export function extractIdKeysByFkId<TRow>(
  columns: AdminColumnDef<TRow>[],
): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};

  for (const col of columns) {
    const meta = col.meta?.fk;

    if (!meta?.idKey) {
      continue;
    }
    out[meta.fk.id] = meta.idKey;
  }

  return out;
}
