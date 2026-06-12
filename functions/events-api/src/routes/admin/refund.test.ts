import assert from "node:assert/strict";
import { afterEach, describe, it, mock, type Mock } from "node:test";

import { SumUpApiError } from "../../helpers/sumup";
import { ordersService } from "../../services/orders.service";
import { createRefundOrder, type RefundOrderDeps } from "./refund";

type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.get>>>;

function baseOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1",
    eventId: "event-1",
    personId: "person-1",
    locale: "en",
    paymentProvider: "stripe",
    stripePaymentIntentId: "pi_123",
    sumupClientTransactionId: null,
    sumupReaderId: null,
    posSoldBy: null,
    status: "paid",
    amountCents: 2500,
    inviteLinkId: null,
    promotionCodeId: null,
    checkoutFulfilledAt: new Date(),
    accessEmailSentAt: null,
    registrationId: null,
    orderKind: "registration",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

type TestRefundDeps = {
  [K in keyof RefundOrderDeps]: RefundOrderDeps[K] extends (...args: infer A) => infer R
    ? Mock<(...args: A) => R>
    : RefundOrderDeps[K];
};

function createTestDeps(overrides: Partial<RefundOrderDeps> = {}): TestRefundDeps {
  return {
    getOrder: mock.fn(async () => null),
    getOrderInTx: mock.fn(async () => null),
    runOrderRefundTransaction: mock.fn(async (fn) => {
      await fn({});
    }),
    refundStripePaymentIntent: mock.fn(async () => undefined),
    refundSumUpClientTransaction: mock.fn(async () => undefined),
    applyRefundEffectsInTx: mock.fn(async () => undefined),
    isSumUpConfigured: mock.fn(() => true),
    ...overrides,
  } as TestRefundDeps;
}

describe("refundOrder", () => {
  afterEach(() => {
    mock.reset();
  });

  it("returns success for already refunded orders without calling providers", async () => {
    const deps = createTestDeps({
      getOrder: mock.fn(async () => baseOrder({ status: "refunded" })),
    });
    const refundOrder = createRefundOrder(deps);

    const res = await refundOrder({ orderId: "order-1" });

    assert.deepEqual(res, { ok: true, pending: true });
    assert.equal(deps.refundStripePaymentIntent.mock.callCount(), 0);
    assert.equal(deps.refundSumUpClientTransaction.mock.callCount(), 0);
    assert.equal(deps.runOrderRefundTransaction.mock.callCount(), 0);
  });

  it("rejects SumUp orders without a client transaction id", async () => {
    const deps = createTestDeps({
      getOrder: mock.fn(async () =>
        baseOrder({
          paymentProvider: "sumup",
          stripePaymentIntentId: null,
          sumupClientTransactionId: null,
        }),
      ),
    });
    const refundOrder = createRefundOrder(deps);

    const res = await refundOrder({ orderId: "order-1" });

    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "order_not_refundable");
      assert.match(res.error, /SumUp payment/i);
    }
    assert.equal(deps.refundSumUpClientTransaction.mock.callCount(), 0);
  });

  it("refunds Stripe orders via Stripe and does not apply DB effects inline", async () => {
    const deps = createTestDeps({
      getOrder: mock.fn(async () => baseOrder()),
    });
    const refundOrder = createRefundOrder(deps);

    const res = await refundOrder({ orderId: "order-1" });

    assert.deepEqual(res, { ok: true, pending: true });
    assert.equal(deps.refundStripePaymentIntent.mock.callCount(), 1);
    assert.deepEqual(deps.refundStripePaymentIntent.mock.calls[0]?.arguments, ["pi_123"]);
    assert.equal(deps.runOrderRefundTransaction.mock.callCount(), 0);
    assert.equal(deps.applyRefundEffectsInTx.mock.callCount(), 0);
  });

  it("refunds SumUp orders via SumUp and applies DB effects synchronously", async () => {
    const order = baseOrder({
      paymentProvider: "sumup",
      stripePaymentIntentId: null,
      sumupClientTransactionId: "ctx_123",
    });
    const deps = createTestDeps({
      getOrder: mock.fn(async () => order),
      getOrderInTx: mock.fn(async () => order),
    });
    const refundOrder = createRefundOrder(deps);

    const res = await refundOrder({ orderId: "order-1" });

    assert.deepEqual(res, { ok: true, pending: true });
    assert.equal(deps.refundSumUpClientTransaction.mock.callCount(), 1);
    assert.deepEqual(deps.refundSumUpClientTransaction.mock.calls[0]?.arguments, ["ctx_123"]);
    assert.equal(deps.runOrderRefundTransaction.mock.callCount(), 1);
    assert.equal(deps.applyRefundEffectsInTx.mock.callCount(), 1);
    assert.equal(deps.refundStripePaymentIntent.mock.callCount(), 0);
  });

  it("repairs local DB state when SumUp reports the transaction is already refunded", async () => {
    const order = baseOrder({
      paymentProvider: "sumup",
      stripePaymentIntentId: null,
      sumupClientTransactionId: "ctx_123",
    });
    const deps = createTestDeps({
      getOrder: mock.fn(async () => order),
      getOrderInTx: mock.fn(async () => order),
      refundSumUpClientTransaction: mock.fn(async () => {
        throw new SumUpApiError("Already refunded.", "conflict", 409);
      }),
    });
    const refundOrder = createRefundOrder(deps);

    const res = await refundOrder({ orderId: "order-1" });

    assert.deepEqual(res, { ok: true, pending: true });
    assert.equal(deps.runOrderRefundTransaction.mock.callCount(), 1);
    assert.equal(deps.applyRefundEffectsInTx.mock.callCount(), 1);
  });
});
