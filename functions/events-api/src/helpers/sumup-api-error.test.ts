import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSumUpApiError } from "./sumup";

describe("mapSumUpApiError", () => {
  it("maps reader offline responses to 503", () => {
    const mapped = mapSumUpApiError(
      { error: { title: "Reader Offline", detail: "Terminal unreachable." } },
      "Failed.",
    );

    assert.equal(mapped.code, "reader_offline");
    assert.equal(mapped.httpStatus, 503);
    assert.match(mapped.message, /offline/i);
  });

  it("maps not found responses to 404", () => {
    const mapped = mapSumUpApiError(
      { error: { title: "Not Found", detail: "Reader rdr_123 was not found." } },
      "Failed.",
    );

    assert.equal(mapped.code, "not_found");
    assert.equal(mapped.httpStatus, 404);
    assert.match(mapped.message, /rdr_123/);
  });

  it("maps active checkout responses to 409", () => {
    const mapped = mapSumUpApiError(
      { error: { title: "Conflict", detail: "Reader checkout in progress." } },
      "Failed.",
    );

    assert.equal(mapped.code, "conflict");
    assert.equal(mapped.httpStatus, 409);
    assert.match(mapped.message, /checkout/i);
  });

  it("falls back to upstream detail for unknown errors", () => {
    const mapped = mapSumUpApiError(
      { error: { title: "Bad Gateway", detail: "Upstream timeout." } },
      "Failed to delete reader.",
    );

    assert.equal(mapped.code, "unknown");
    assert.equal(mapped.httpStatus, 502);
    assert.equal(mapped.message, "Upstream timeout.");
  });
});
