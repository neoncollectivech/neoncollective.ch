import { actionProvider } from "@neon/resource-api";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { refundOrder, type RefundOrderFailureReason } from "../refund";

const REFUND_ERRORS: Record<RefundOrderFailureReason, { status: ContentfulStatusCode; error: string }> = {
  order_not_found: { status: 404, error: "Order not found." },
  order_not_refundable: { status: 400, error: "Order cannot be refunded in its current state." },
  stripe_failed: { status: 502, error: "Stripe refund failed" },
};

export function createOrdersControlRouter(): Hono {
  const control = new Hono();

  control.route(
    "/",
    actionProvider(
      [
        {
          method: "post",
          path: "/:id/refund",
          handler: async (c) => {
            const res = await refundOrder({ orderId: c.req.param("id") });
            if (!res.ok) {
              const mapped = REFUND_ERRORS[res.reason];
              return c.json({ error: res.error || mapped.error }, mapped.status);
            }
            return c.json({ ok: true, pending: true }, 202);
          },
        },
      ],
      [],
    ),
  );

  return control;
}
