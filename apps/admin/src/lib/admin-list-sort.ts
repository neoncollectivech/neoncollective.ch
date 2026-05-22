export type AdminSortDirection = "asc" | "desc";

export function toAdminSortParam(
  field: string,
  direction: AdminSortDirection,
): string {
  return direction === "desc" ? `-${field}` : field;
}

export function compareSortValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
): number {
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}
