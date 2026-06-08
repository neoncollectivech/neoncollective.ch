import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildSumUpAppSwitchUrl } from "./sumup";

describe("buildSumUpAppSwitchUrl", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SUMUP_AFFILIATE_KEY = "test-affiliate";
    process.env.SUMUP_APP_ID = "com.neon.door";
    process.env.SUMUP_APP_SWITCH_CALLBACK_BASE =
      "https://neoncollective.ch/door/pos";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds iOS Payment Switch URL with amount and dual callbacks", () => {
    const url = buildSumUpAppSwitchUrl({
      orderId: "order-123",
      amountCents: 2500,
      currency: "chf",
      title: "Test event",
      platform: "ios",
    });

    assert.match(url, /^sumupmerchant:\/\/pay\/1\.0\?/);
    assert.match(url, /amount=25\.00/);
    assert.match(url, /currency=CHF/);
    assert.match(url, /affiliate-key=test-affiliate/);
    assert.match(url, /foreign-tx-id=order-123/);
    assert.match(url, /skip-screen-success=true/);
    assert.match(url, /callbacksuccess=/);
    assert.match(url, /callbackfail=/);
    assert.match(url, /sumup%3Dreturn/);
    assert.match(url, /orderId%3Dorder-123/);
    assert.doesNotMatch(url, /app-id=/);
  });

  it("builds Android Payment Switch URL with total, callback, and app-id", () => {
    const url = buildSumUpAppSwitchUrl({
      orderId: "order-456",
      amountCents: 100,
      currency: "eur",
      title: "Addon",
      platform: "android",
    });

    assert.match(url, /total=1\.00/);
    assert.match(url, /callback=/);
    assert.match(url, /app-id=com\.neon\.door/);
    assert.doesNotMatch(url, /callbacksuccess=/);
  });
});
