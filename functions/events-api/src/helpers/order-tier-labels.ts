export type AdminOrderTierLine = {
  id: string;
  name: string;
  selectionMode: "exclusive" | "addon";
  unitPriceCents: number;
};

export function formatOrderTierNamesFromLines(lines: AdminOrderTierLine[]): string {
  if (lines.length === 0) {
    return "";
  }
  const exclusive = lines.filter((r) => r.selectionMode === "exclusive");
  const addons = lines.filter((r) => r.selectionMode === "addon");
  const parts = [...exclusive.map((r) => r.name), ...addons.map((r) => r.name)];
  return parts.join(" + ");
}
