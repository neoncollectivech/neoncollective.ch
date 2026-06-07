import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  apiKeyHasScope,
  defaultScopesForApiKey,
  normalizeApiKeyScopes,
} from "./api-keys";

describe("api-keys config", () => {
  it("defaults event keys to check-in and POS", () => {
    assert.deepEqual(defaultScopesForApiKey("ev-1"), ["check_in", "pos"]);
  });

  it("defaults global keys to all capabilities", () => {
    assert.deepEqual(defaultScopesForApiKey(null), [
      "check_in",
      "pos",
      "pos_admin",
      "admissions_list",
    ]);
  });

  it("filters unknown scopes and falls back when empty", () => {
    assert.deepEqual(normalizeApiKeyScopes(["check_in", "unknown"]), ["check_in"]);
    assert.deepEqual(normalizeApiKeyScopes([]), ["check_in", "pos"]);
  });

  it("checks scope membership", () => {
    assert.equal(
      apiKeyHasScope({ scopes: ["check_in", "pos"] }, "pos"),
      true,
    );
    assert.equal(
      apiKeyHasScope({ scopes: ["check_in"] }, "pos_admin"),
      false,
    );
  });
});
