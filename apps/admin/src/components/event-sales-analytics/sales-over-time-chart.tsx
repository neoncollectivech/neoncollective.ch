import type { SalesMetric } from "./types";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import {
  formatAxisValue,
  formatChartDate,
  formatChartDateLong,
  formatChfFromCents,
  formatMetricValue,
  formatOrders,
  salesChartConfig,
  salesChartContainerClassName,
  salesChartInitialDimension,
  shouldShowXAxisLabel,
  type SalesChartPoint,
} from "./sales-chart-utils";

type SalesOverTimeChartProps = {
  data: SalesChartPoint[];
  metric: SalesMetric;
};

export function SalesOverTimeChart({ data, metric }: SalesOverTimeChartProps) {
  const dataKey = metric === "revenue" ? "revenueCents" : "orderCount";

  return (
    <ChartContainer
      className={salesChartContainerClassName}
      config={salesChartConfig}
      initialDimension={salesChartInitialDimension}
    >
      <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="date"
          tickFormatter={(value, index) =>
            shouldShowXAxisLabel(index, data.length)
              ? formatChartDate(String(value))
              : ""
          }
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tickFormatter={(value) => formatAxisValue(Number(value), metric)}
          tickLine={false}
          width={48}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideIndicator
              hideLabel
              formatter={(value, _name, item) => {
                const day = item.payload as SalesChartPoint;
                const primary = formatMetricValue(Number(value), metric);
                const secondary =
                  metric === "revenue"
                    ? formatOrders(day.orderCount)
                    : formatChfFromCents(day.revenueCents);

                return (
                  <span className="font-mono font-medium tabular-nums">
                    {primary} · {secondary}
                  </span>
                );
              }}
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date as string | undefined;

                return date ? formatChartDateLong(date) : "";
              }}
            />
          }
        />
        <Bar
          dataKey={dataKey}
          fill="var(--color-chart-1)"
          maxBarSize={48}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
