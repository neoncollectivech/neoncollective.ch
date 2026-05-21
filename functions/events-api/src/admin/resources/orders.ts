import { actionProvider } from "@neon/admin-crud";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { deleteUnpaidAdminOrder } from "../../services/admin/orders-mutate";
import { ordersService } from "../../services/orders.service";
import { refundOrder } from "../../services/checkin-refund";
import { defineAdminResource } from "../resource";
import type { AdminServiceBridge } from "../service-bridge";

function orderRefundExtension(): Hono {
  return actionProvider(
    [
      {
        method: "post",
        path: "/:id/refund",
        handler: async (c) => {
          const res = await refundOrder({ orderId: c.req.param("id") });
          if (!res.ok) {
            return c.json({ error: res.error }, res.status as ContentfulStatusCode);
          }
          return c.json({ ok: true });
        },
      },
    ],
    [],
  );
}

const ordersBridge: AdminServiceBridge = {
  list: (query, ctx) => ordersService.list(query, ctx),
  count: (query, ctx) => ordersService.count(query, ctx),
  getDetail: (id, ctx) => ordersService.getDetail(id, ctx),
  parseListQuery: (raw) => ordersService.parseListQuery(raw),
};

export const orders = defineAdminResource({
  service: ordersBridge,
  actions: [
    {
      method: "delete",
      path: "/:id",
      handler: async (c) => {
        const res = await deleteUnpaidAdminOrder(c.req.param("id")!);
        if (!res.ok) {
          return c.json({ error: res.error }, res.status as ContentfulStatusCode);
        }
        return c.json({ ok: true });
      },
    },
  ],
  extensions: () => [orderRefundExtension()],
});
