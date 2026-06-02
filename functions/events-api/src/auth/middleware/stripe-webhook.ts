import type { ContentfulStatusCode } from "hono/utils/http-status";

import { authFactory } from "../factory";
import { resolveStripeEvent } from "../resolvers/stripe-event";

export const verifyStripeWebhook = authFactory.createMiddleware(async (c, next) => {
  const sig = c.req.header("stripe-signature");
  const raw = await c.req.text();
  const res = await resolveStripeEvent(raw, sig);
  if (!res.ok) {
    return c.text(res.error, res.status as ContentfulStatusCode);
  }
  c.set("stripeEvent", res.event);
  await next();
});
