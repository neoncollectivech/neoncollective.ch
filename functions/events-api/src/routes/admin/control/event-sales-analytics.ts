import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { eventsService } from "../../../services/events.service";
import { ordersService } from "../../../services/orders.service";
import { jsonReasonFailure } from "../../shared/respond";

const SALES_ANALYTICS_ERRORS = {
  event_not_found: { status: 404 as ContentfulStatusCode, error: "Event not found." },
} as const;

export async function getEventSalesAnalyticsHandler(c: Context): Promise<Response> {
  const eventId = c.req.param("id")!;
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, SALES_ANALYTICS_ERRORS);
  }

  const analytics = await ordersService.aggregateSalesByDayForEvent(
    eventId,
    ev.startsAt,
  );

  return c.json({
    bucket: "day" as const,
    series: analytics.series,
    totals: analytics.totals,
  });
}
