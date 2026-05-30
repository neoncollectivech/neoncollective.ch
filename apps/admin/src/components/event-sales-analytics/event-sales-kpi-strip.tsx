import type { EventSalesAnalytics } from "@/lib/admin-api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatChfFromCents } from "./sales-chart-utils";

type EventSalesKpiStripProps = {
  totals: EventSalesAnalytics["totals"];
};

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function EventSalesKpiStrip({ totals }: EventSalesKpiStripProps) {
  const avgValue =
    totals.avgOrderValueCents != null
      ? formatChfFromCents(totals.avgOrderValueCents)
      : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <KpiCard
        label="Total revenue"
        value={formatChfFromCents(totals.revenueCents)}
      />
      <KpiCard label="Paid orders" value={String(totals.orderCount)} />
      <KpiCard label="Avg. order value" value={avgValue} />
    </div>
  );
}
