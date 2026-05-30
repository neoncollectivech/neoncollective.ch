import type { SalesMetric } from "./types";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { adminApi } from "@/hooks/use-admin-api";

import { EventSalesKpiStrip } from "./event-sales-kpi-strip";
import { SalesMetricChart } from "./sales-metric-chart";
import { buildSalesChartPoints } from "./sales-chart-utils";

type EventSalesAnalyticsProps = {
  eventId: string;
};

function ChartPlaceholder() {
  return <div className="min-h-[280px] rounded-md bg-muted/40" />;
}

export function EventSalesAnalytics({ eventId }: EventSalesAnalyticsProps) {
  const [metric, setMetric] = useState<SalesMetric>("revenue");
  const analyticsQuery = useQuery({
    ...adminApi.event.salesAnalytics(eventId),
  });

  const chartData = useMemo(
    () => buildSalesChartPoints(analyticsQuery.data?.series ?? []),
    [analyticsQuery.data?.series],
  );

  const hasSales = (analyticsQuery.data?.totals.orderCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Sales analytics</h3>
          <p className="text-sm text-muted-foreground">
            Paid orders only. One order = one person. Capacity below includes
            pending checkout.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={metric}
          variant="outline"
          onValueChange={(value) => {
            if (value === "revenue" || value === "orders") {
              setMetric(value);
            }
          }}
        >
          <ToggleGroupItem aria-label="Revenue" value="revenue">
            Revenue
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="Orders" value="orders">
            Orders
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {analyticsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <ChartPlaceholder />
            <ChartPlaceholder />
            <ChartPlaceholder />
          </div>
          <ChartPlaceholder />
          <ChartPlaceholder />
        </div>
      ) : null}

      {analyticsQuery.isError ? (
        <p className="text-sm text-red-500">Failed to load sales analytics.</p>
      ) : null}

      {analyticsQuery.data ? (
        <>
          <EventSalesKpiStrip totals={analyticsQuery.data.totals} />

          {hasSales ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sales over time</CardTitle>
                </CardHeader>
                <CardContent>
                  <SalesMetricChart
                    data={chartData}
                    metric={metric}
                    variant="bar"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cumulative total</CardTitle>
                </CardHeader>
                <CardContent>
                  <SalesMetricChart
                    data={chartData}
                    metric={metric}
                    variant="line"
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No paid orders yet.
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
