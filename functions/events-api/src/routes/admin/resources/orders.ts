import { actionProvider } from "@neon/admin-crud";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { orders as ordersTable } from "../../../db/schema";
import { ordersFilterable, ordersService } from "../../../services/orders.service";
import { getAdminOrderDetail } from "../providers/orders-admin";
import { refundOrder, type RefundOrderFailureReason } from "../refund";
import { defineAdminResource } from "../resource";
import { jsonReasonFailure } from "../../shared/respond";

const ordersFilterFields = Object.fromEntries(
  ordersFilterable.map((f) => [f.name, f.column]),
) as Record<string, import("drizzle-orm/pg-core").PgColumn>;

const REFUND_ERRORS: Record<RefundOrderFailureReason, { status: ContentfulStatusCode; error: string }> = {
  order_not_found: { status: 404, error: "Order not found." },
  order_not_refundable: { status: 400, error: "Order cannot be refunded in its current state." },
  stripe_failed: { status: 502, error: "Stripe refund failed" },
};

const DELETE_ORDER_ERRORS = {
  order_not_found: { status: 404 as ContentfulStatusCode, error: "Order not found." },
  order_not_deletable: {
    status: 400 as ContentfulStatusCode,
    error: "Only pending or failed orders can be deleted. Refund paid orders instead.",
  },
} as const;

function orderRefundExtension(): Hono {
  return actionProvider(
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
  );
}

export const orders = defineAdminResource({
  table: ordersTable,
  detail: async (id) => getAdminOrderDetail(id),
  opts: {
    operations: ["list"],
    list: {
      filterFields: ordersFilterFields,
      defaultSort: "-createdAt",
    },
    fields: {
      list: [
        "id",
        "eventId",
        "personId",
        "status",
        "amountCents",
        "locale",
        "createdAt",
      ],
    },
  },
  actions: [
    {
      method: "delete",
      path: "/:id",
      handler: async (c) => {
        const res = await ordersService.deleteDeletableAdminOrder(c.req.param("id")!);
        if (!res.ok) {
          return jsonReasonFailure(c, res, DELETE_ORDER_ERRORS);
        }
        return c.json({ ok: true });
      },
    },
  ],
  extensions: () => [orderRefundExtension()],
});
