import type { SalesMetric } from "./types";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

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

type SalesMetricChartProps = {
  data: SalesChartPoint[];
  metric: SalesMetric;
  variant: "bar" | "line";
};

function chartDataKey(metric: SalesMetric, variant: "bar" | "line"): string {
  if (variant === "bar") {
    return metric === "revenue" ? "revenueCents" : "orderCount";
  }

  return metric === "revenue"
    ? "cumulativeRevenueCents"
    : "cumulativeOrderCount";
}

function ChartTooltipBody({ metric }: { metric: SalesMetric }) {
  return (
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
  );
}

export function SalesMetricChart({
  data,
  metric,
  variant,
}: SalesMetricChartProps) {
  const dataKey = chartDataKey(metric, variant);
  const axes = (
    <>
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
      <ChartTooltip content={<ChartTooltipBody metric={metric} />} />
    </>
  );

  return (
    <ChartContainer
      className={salesChartContainerClassName}
      config={salesChartConfig}
      initialDimension={salesChartInitialDimension}
    >
      {variant === "bar" ? (
        <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8 }}>
          {axes}
          <Bar
            dataKey={dataKey}
            fill="var(--color-chart-1)"
            maxBarSize={48}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      ) : (
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ left: 8, right: 8 }}
        >
          {axes}
          <Line
            dataKey={dataKey}
            dot={false}
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      )}
    </ChartContainer>
  );
}
