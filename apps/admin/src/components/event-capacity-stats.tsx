import type { EventCapacitySnapshot, TierRow } from "@/lib/admin-types";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-medium">Capacity</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Counts include pending and paid orders.
        </p>
      </div>

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
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Quota</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier) => (
              <TableRow key={tier.id ?? tier.name}>
                <TableCell className="font-medium">{tier.name}</TableCell>
                <TableCell>
                  <Badge variant={tier.active ? "default" : "secondary"}>
                    {tier.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCap(tier.quota)}</TableCell>
                <TableCell className="text-right">{tier.sold ?? 0}</TableCell>
                <TableCell className="text-right">
                  {formatCap(tier.placesRemaining)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No tiers configured yet.</p>
      )}
    </div>
  );
}
