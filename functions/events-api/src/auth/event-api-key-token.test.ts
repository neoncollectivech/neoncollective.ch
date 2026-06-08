import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Hono } from "hono";

import type { AppEnv } from "./env";
import {
  EVENT_API_KEY_QUERY_PARAM,
  extractEventApiKeyToken,
} from "./event-api-key-token";

const SAMPLE_TOKEN = `neon_${"a".repeat(48)}`;

function appWithExtract(method: "GET" | "POST", path: string, init?: RequestInit) {
  const app = new Hono<AppEnv>();
  app.all("*", (c) => c.json({ token: extractEventApiKeyToken(c) }));
  return app.request(path, { method, ...init });
}

describe("extractEventApiKeyToken", () => {
  it("reads Bearer token from Authorization header", async () => {
    const res = await appWithExtract("GET", "/test", {
      headers: { Authorization: `Bearer ${SAMPLE_TOKEN}` },
    });
    const body = (await res.json()) as { token: string | null };
    assert.equal(body.token, SAMPLE_TOKEN);
  });

  it("reads apiKey query param on GET", async () => {
    const res = await appWithExtract(
      "GET",
      `/test?${EVENT_API_KEY_QUERY_PARAM}=${encodeURIComponent(SAMPLE_TOKEN)}`,
    );
    const body = (await res.json()) as { token: string | null };
    assert.equal(body.token, SAMPLE_TOKEN);
  });

  it("prefers Bearer over query param on GET", async () => {
    const bearerToken = `neon_${"b".repeat(48)}`;
    const res = await appWithExtract(
      "GET",
      `/test?${EVENT_API_KEY_QUERY_PARAM}=${encodeURIComponent(SAMPLE_TOKEN)}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    const body = (await res.json()) as { token: string | null };
    assert.equal(body.token, bearerToken);
  });

  it("ignores apiKey query param on non-GET requests", async () => {
    const res = await appWithExtract(
      "POST",
      `/test?${EVENT_API_KEY_QUERY_PARAM}=${encodeURIComponent(SAMPLE_TOKEN)}`,
    );
    const body = (await res.json()) as { token: string | null };
    assert.equal(body.token, null);
  });

  it("returns null when no credentials are present", async () => {
    const res = await appWithExtract("GET", "/test");
    const body = (await res.json()) as { token: string | null };
    assert.equal(body.token, null);
  });
});
