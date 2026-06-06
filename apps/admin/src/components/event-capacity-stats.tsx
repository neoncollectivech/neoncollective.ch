import type { EventCapacitySnapshot, TierRow } from "@/lib/admin-types";

import { AdminSortableTableHead } from "@/components/admin-sortable-table-head";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientTableSort } from "@/hooks/use-client-table-sort";

function formatCap(value: number | null | undefined): string {
  if (value == null) {
    return "Unlimited";
  }

  return String(value);
}

type EventCapacityStatsProps = {
  eventQuota: number | null;
  capacity: EventCapacitySnapshot | undefined;
  tiers: TierRow[];
};

export function EventCapacityStats({
  eventQuota,
  capacity,
  tiers,
}: EventCapacityStatsProps) {
  const used = capacity?.used ?? 0;
  const eventRemaining = capacity?.remaining ?? null;
  const tierSort = useClientTableSort(tiers, {
    defaultField: "name",
    getValue: (row, field) => {
      if (field === "status") {
        return row.active ? "active" : "inactive";
      }
      if (field === "remaining") {
        return row.placesRemaining ?? Number.MAX_SAFE_INTEGER;
      }

      return (row as Record<string, unknown>)[field] as
        | string
        | number
        | boolean
        | null
        | undefined;
    },
  });

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Capacity</h3>

      <div className="rounded-md border border-border p-3 text-sm">
        <p className="font-medium">Event total</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Quota</dt>
            <dd>{formatCap(eventQuota)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Used</dt>
            <dd>{used}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining</dt>
            <dd>{formatCap(eventRemaining)}</dd>
          </div>
        </dl>
      </div>

      {tiers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTableHead
                field="name"
                label="Tier"
                sortDirection={tierSort.sortDirection}
                sortField={tierSort.sortField}
                onSort={tierSort.toggleSort}
              />
              <AdminSortableTableHead
                field="status"
                label="Status"
                sortDirection={tierSort.sortDirection}
                sortField={tierSort.sortField}
                onSort={tierSort.toggleSort}
              />
              <AdminSortableTableHead
                className="text-right"
                field="quota"
                label="Quota"
                sortDirection={tierSort.sortDirection}
                sortField={tierSort.sortField}
                onSort={tierSort.toggleSort}
              />
              <AdminSortableTableHead
                className="text-right"
                field="sold"
                label="Sold"
                sortDirection={tierSort.sortDirection}
                sortField={tierSort.sortField}
                onSort={tierSort.toggleSort}
              />
              <AdminSortableTableHead
                className="text-right"
                field="remaining"
                label="Remaining"
                sortDirection={tierSort.sortDirection}
                sortField={tierSort.sortField}
                onSort={tierSort.toggleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tierSort.rows.map((tier) => (
              <TableRow key={tier.id ?? tier.name}>
                <TableCell className="font-medium">{tier.name}</TableCell>
                <TableCell>
                  <Badge variant={tier.active ? "default" : "secondary"}>
                    {tier.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCap(tier.quota)}
                </TableCell>
                <TableCell className="text-right">{tier.sold ?? 0}</TableCell>
                <TableCell className="text-right">
                  {formatCap(tier.placesRemaining)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">
          No tiers configured yet.
        </p>
      )}
    </div>
  );
}
