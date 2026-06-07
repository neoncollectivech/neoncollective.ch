import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resetStripeApiEnvForTests } from "./config/runtime-env";
import { validatePublicSiteReturnUrl } from "./validate-return-url";

describe("validatePublicSiteReturnUrl", () => {
  it("accepts URLs on PUBLIC_SITE_URL origin", () => {
    resetStripeApiEnvForTests({ PUBLIC_SITE_URL: "https://neoncollective.ch" });
    assert.equal(
      validatePublicSiteReturnUrl("https://neoncollective.ch/en/donate"),
      "https://neoncollective.ch/en/donate",
    );
  });

  it("rejects other origins", () => {
    resetStripeApiEnvForTests({ PUBLIC_SITE_URL: "https://neoncollective.ch" });
    assert.equal(
      validatePublicSiteReturnUrl("https://evil.example/phish"),
      null,
    );
  });

  it("rejects non-http(s) schemes", () => {
    resetStripeApiEnvForTests({ PUBLIC_SITE_URL: "https://neoncollective.ch" });
    assert.equal(validatePublicSiteReturnUrl("javascript:alert(1)"), null);
  });
});
