import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readEventsApiEnv, resetEventsApiEnvForTests } from "../config/runtime-env";
import { devAdminSession, isAdminAuthDisabled } from "./admin-auth-dev";

describe("admin-auth-dev", () => {
  it("is disabled in production even when ADMIN_AUTH_DISABLED=1", () => {
    const env = readEventsApiEnv({
      NODE_ENV: "production",
      ADMIN_AUTH_DISABLED: "1",
    });
    assert.equal(env.adminAuthDisabled, false);
  });

  it("is enabled only outside production with ADMIN_AUTH_DISABLED=1", () => {
    const env = readEventsApiEnv({
      NODE_ENV: "development",
      ADMIN_AUTH_DISABLED: "1",
    });
    assert.equal(env.adminAuthDisabled, true);
  });

  it("devAdminSession uses @neonclub.ch email", () => {
    resetEventsApiEnvForTests({ NODE_ENV: "development" });
    const session = devAdminSession();
    assert.match(session.user.email, /@neonclub\.ch$/);
  });
});

describe("isAdminAuthDisabled runtime guard", () => {
  it("returns false when NODE_ENV is production", () => {
    resetEventsApiEnvForTests({
      NODE_ENV: "production",
      ADMIN_AUTH_DISABLED: "1",
    });
    assert.equal(isAdminAuthDisabled(), false);
  });

  it("returns true when non-production and ADMIN_AUTH_DISABLED=1", () => {
    resetEventsApiEnvForTests({
      NODE_ENV: "development",
      ADMIN_AUTH_DISABLED: "1",
    });
    assert.equal(isAdminAuthDisabled(), true);
  });
});
