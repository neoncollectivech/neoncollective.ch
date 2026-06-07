import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { apiKeyGrantsEvent, isGlobalApiKey } from "./event-api-key";
import { isApiKeyTokenFormat } from "../../services/api-keys.service";

describe("apiKeyGrantsEvent", () => {
  it("grants global keys for any event", () => {
    assert.equal(
      apiKeyGrantsEvent({ eventId: null }, "ev-1"),
      true,
    );
    assert.equal(
      apiKeyGrantsEvent({ eventId: null }, "ev-2"),
      true,
    );
  });

  it("grants scoped keys only for matching event", () => {
    assert.equal(
      apiKeyGrantsEvent({ eventId: "ev-1" }, "ev-1"),
      true,
    );
    assert.equal(
      apiKeyGrantsEvent({ eventId: "ev-1" }, "ev-2"),
      false,
    );
  });
});

describe("isGlobalApiKey", () => {
  it("is true only when eventId is null", () => {
    assert.equal(isGlobalApiKey({ eventId: null }), true);
    assert.equal(isGlobalApiKey({ eventId: "ev-1" }), false);
  });
});

describe("isApiKeyTokenFormat", () => {
  it("accepts neon_ prefixed tokens with sufficient length", () => {
    assert.equal(
      isApiKeyTokenFormat(`neon_${"a".repeat(48)}`),
      true,
    );
  });

  it("rejects missing prefix or too short tokens", () => {
    assert.equal(isApiKeyTokenFormat("bad_token"), false);
    assert.equal(isApiKeyTokenFormat("neon_short"), false);
    assert.equal(isApiKeyTokenFormat(""), false);
  });
});
