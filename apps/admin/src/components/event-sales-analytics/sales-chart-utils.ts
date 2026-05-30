import type { EventSalesAnalyticsDay } from "@/lib/admin-api";
import type { SalesMetric } from "./types";

export type SalesChartPoint = EventSalesAnalyticsDay & {
  cumulativeRevenueCents: number;
  cumulativeOrderCount: number;
};

export function buildSalesChartPoints(
  series: EventSalesAnalyticsDay[],
): SalesChartPoint[] {
  let cumulativeRevenueCents = 0;
  let cumulativeOrderCount = 0;

  return series.map((day) => {
    cumulativeRevenueCents += day.revenueCents;
    cumulativeOrderCount += day.orderCount;

    return {
      ...day,
      cumulativeRevenueCents,
      cumulativeOrderCount,
    };
  });
}

export function formatChfFromCents(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

export function formatOrders(count: number): string {
  return count === 1 ? "1 order" : `${count} orders`;
}

export function formatMetricValue(value: number, metric: SalesMetric): string {
  if (metric === "revenue") {
    return formatChfFromCents(value);
  }

  return String(value);
}

export function formatAxisValue(value: number, metric: SalesMetric): string {
  if (metric === "revenue") {
    if (value >= 100_000) {
      return `${Math.round(value / 100_000)}k`;
    }

    return `${Math.round(value / 100)}`;
  }

  return String(value);
}

export function formatChartDate(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatChartDateLong(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shouldShowXAxisLabel(index: number, total: number): boolean {
  if (total <= 7) {
    return true;
  }

  const step = Math.ceil(total / 7);

  return index % step === 0 || index === total - 1;
}

export const salesChartConfig = {
  value: {
    label: "Value",
    color: "var(--color-chart-1)",
  },
} as const;

export const salesChartContainerClassName = "aspect-auto h-[280px] w-full";

export const salesChartInitialDimension = {
  width: 640,
  height: 280,
} as const;
