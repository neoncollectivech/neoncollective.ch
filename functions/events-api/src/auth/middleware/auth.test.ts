import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { some } from "hono/combine";

import { resetEventsApiEnvForTests } from "../../config/runtime-env";
import { authFactory } from "../factory";
import { requireAuth, requireAdminSession, requireParticipantPerson } from "./assert";
import { loadAdminSession, loadEventApiKey, loadParticipantSession } from "./loaders";

function testApp() {
  const app = authFactory.createApp();
  app.onError((err, c) =>
    c.json(
      { error: err.message },
      ("statusCode" in err ? err.statusCode : 500) as ContentfulStatusCode,
    ),
  );
  return app;
}

describe("auth assert middleware", () => {
  it("requireAuth returns 401 when variable is unset", async () => {
    const app = testApp();
    app.use("*", requireAuth("participantSession"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    assert.equal(res.status, 401);
  });

  it("requireAuth passes when variable is set", async () => {
    const app = testApp();
    app.use("*", async (c, next) => {
      c.set("participantSession", {
        sessionId: "s1",
        personId: "p1",
        eventInviteeId: null,
        inviteLinkId: null,
        email: null,
        phoneE164: null,
        givenName: "",
        familyName: "",
      });
      await next();
    });
    app.use("*", requireAuth("participantSession"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    assert.equal(res.status, 200);
  });

  it("requireParticipantPerson returns 401 when personId is missing", async () => {
    const app = testApp();
    app.use("*", async (c, next) => {
      c.set("participantSession", {
        sessionId: "s1",
        personId: null,
        eventInviteeId: null,
        inviteLinkId: null,
        email: null,
        phoneE164: null,
        givenName: "",
        familyName: "",
      });
      await next();
    });
    app.use("*", requireParticipantPerson);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    assert.equal(res.status, 401);
  });

  it("requireAdminSession returns 401 when admin session is missing", async () => {
    const app = testApp();
    app.use("*", requireAdminSession);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    assert.equal(res.status, 401);
  });

  it("requireAdminSession passes when dev bypass loader ran", async () => {
    resetEventsApiEnvForTests({
      NODE_ENV: "development",
      ADMIN_AUTH_DISABLED: "1",
    });

    const app = testApp();
    app.use("*", loadAdminSession);
    app.use("*", requireAdminSession);
    app.get("/test", (c) => c.json({ email: c.var.adminSession?.user.email }));

    const res = await app.request("/test");
    assert.equal(res.status, 200);
    const body = (await res.json()) as { email: string };
    assert.match(body.email, /@neonclub\.ch$/);

    resetEventsApiEnvForTests();
  });
});

describe("auth loader middleware", () => {
  it("loaders always call next without 401", async () => {
    const app = authFactory.createApp();
    app.use("*", loadParticipantSession);
    app.use("*", loadEventApiKey);
    app.get("/test", (c) =>
      c.json({
        hasSession: Boolean(c.var.participantSession),
        hasApiKey: Boolean(c.var.eventApiKey),
      }),
    );

    const res = await app.request("/test");
    assert.equal(res.status, 200);
    const body = (await res.json()) as { hasSession: boolean; hasApiKey: boolean };
    assert.equal(body.hasSession, false);
    assert.equal(body.hasApiKey, false);
  });
});

describe("some() on asserts", () => {
  it("accepts participant session OR event API key", async () => {
    const app = testApp();
    app.use("*", async (c, next) => {
      c.set("eventApiKey", {
        eventId: "ev1",
        keyId: "key1",
        label: "Door",
        scopes: ["check_in", "pos"],
      });
      await next();
    });
    app.use("*", some(requireAuth("participantSession"), requireAuth("eventApiKey")));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    assert.equal(res.status, 200);
  });

  it("returns 401 when neither auth variable is set", async () => {
    const app = testApp();
    app.use("*", some(requireAuth("participantSession"), requireAuth("eventApiKey")));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    assert.equal(res.status, 401);
  });
});
