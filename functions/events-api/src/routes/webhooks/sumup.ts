import { createLogger } from "@neon/server-kit";
import { Hono } from "hono";

import type { AppEnv } from "../../auth/env";
import { authFactory } from "../../auth/factory";
import { verifySumUpWebhookSignature } from "../../helpers/sumup";
import { ordersService } from "../../services/orders.service";
import { runTransaction } from "../../services/transaction";
import { fulfillPaidOrderFromSumup } from "../checkout/fulfill-paid-order";
import { handleFulfillmentResult } from "../checkout/handle-fulfillment-result";

const log = createLogger("sumup-webhook");

type SumUpReaderCheckoutWebhookBody = {
  event_type?: string;
  id?: string;
  payload?: {
    client_transaction_id?: string;
    status?: string;
  };
};

/** Reader checkout `return_url` callbacks (OpenAPI ReaderCheckoutStatusChange). */
function parseReaderCheckoutWebhook(body: SumUpReaderCheckoutWebhookBody): {
  clientTransactionId: string;
  status: "successful" | "failed";
  sumupEventId: string | null;
} | null {
  const clientTransactionId = body.payload?.client_transaction_id?.trim();
  const status = body.payload?.status?.trim().toLowerCase();
  if (!clientTransactionId || (status !== "successful" && status !== "failed")) {
    return null;
  }
  return {
    clientTransactionId,
    status,
    sumupEventId: body.id?.trim() ?? null,
  };
}

export function createSumUpWebhookRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/pos/webhooks/sumup", ...authFactory.createHandlers(async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-payload-signature");
    if (!verifySumUpWebhookSignature(rawBody, signature)) {
      return c.json({ error: "Invalid signature." }, 401);
    }

    let body: SumUpReaderCheckoutWebhookBody;
    try {
      body = JSON.parse(rawBody) as SumUpReaderCheckoutWebhookBody;
    } catch {
      return c.json({ ok: true });
    }

    const parsed = parseReaderCheckoutWebhook(body);
    if (!parsed) {
      return c.json({ ok: true });
    }

    const { clientTransactionId, status, sumupEventId } = parsed;

    const order = await ordersService.getBySumupClientTransactionId(clientTransactionId);
    if (!order) {
      log.warn({ clientTransactionId }, "SumUp webhook for unknown client transaction");
      return c.json({ ok: true });
    }

    if (status === "failed") {
      if (order.status === "pending") {
        await runTransaction((tx) => ordersService.failOrderInTx(tx, order.id));
      }
      return c.json({ ok: true });
    }

    let result;
    try {
      result = await fulfillPaidOrderFromSumup({
        orderId: order.id,
        source: "sumup_webhook",
        sumupEventId: sumupEventId ?? undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "SumUp webhook processing failed";
      log.error({ err: e, orderId: order.id }, msg);
      return c.json({ error: msg }, 500);
    }

    if (result.kind === "failed") {
      log.error({ orderId: order.id, reason: result.reason }, "SumUp fulfillment failed");
      return c.json({ error: result.reason }, 500);
    }

    await handleFulfillmentResult(result);
    return c.json({ ok: true });
  }));

  return router;
}
