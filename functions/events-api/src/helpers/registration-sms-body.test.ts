import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GSM7_SINGLE_SEGMENT_MAX } from "../config/sms";
import {
  buildRegistrationSmsBody,
  webOtpBindingFromPublicSiteUrl,
} from "./registration-sms-body";

describe("registration-sms-body", () => {
  it("binds Web OTP host without default port", () => {
    assert.equal(
      webOtpBindingFromPublicSiteUrl("https://neoncollective.ch"),
      "neoncollective.ch",
    );
  });

  it("includes port in binding when non-default", () => {
    assert.equal(
      webOtpBindingFromPublicSiteUrl("http://localhost:3000"),
      "localhost:3000",
    );
  });

  it("builds body with magic link and Web OTP suffix", () => {
    const result = buildRegistrationSmsBody({
      rawCode: "4k8h9m",
      accessUrl:
        "https://neoncollective.ch/en/events/summer?code=4K8H9M&invite=abc",
      webOtpBinding: "neoncollective.ch",
    });
    assert.equal(typeof result, "string");
    if (typeof result !== "string") {
      return;
    }
    assert.match(result, /^NEON 4K8-H9M\n/);
    assert.ok(result.includes("https://neoncollective.ch/en/events/summer"));
    assert.ok(result.endsWith("@neoncollective.ch #4K8H9M"));
    assert.ok(result.length <= GSM7_SINGLE_SEGMENT_MAX);
  });

  it("omits access URL line when empty (profile SMS)", () => {
    const body = buildRegistrationSmsBody({
      rawCode: "ABCDEF",
      accessUrl: "",
      webOtpBinding: "neoncollective.ch",
    });
    assert.equal(typeof body, "string");
    assert.equal(body, "NEON ABC-DEF\n@neoncollective.ch #ABCDEF");
  });
});
