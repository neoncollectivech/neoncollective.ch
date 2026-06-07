import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  pickLocalizedText,
  pruneLocalizedText,
} from "./index.js";

describe("pruneLocalizedText", () => {
  it("drops empty and unknown keys", () => {
    assert.deepEqual(
      pruneLocalizedText({
        en: "  Hello  ",
        de: "   ",
        fr: "ignored",
        it: "Ciao",
      } as Record<string, string>),
      { en: "Hello", it: "Ciao" },
    );
  });

  it("returns empty object for nullish input", () => {
    assert.deepEqual(pruneLocalizedText(null), {});
    assert.deepEqual(pruneLocalizedText(undefined), {});
  });
});

describe("pickLocalizedText", () => {
  const map = { en: "English", de: "Deutsch" };

  it("prefers requested locale", () => {
    assert.equal(pickLocalizedText(map, "de"), "Deutsch");
  });

  it("falls back to default locale", () => {
    assert.equal(pickLocalizedText(map, "it"), "English");
  });

  it("returns null for empty map", () => {
    assert.equal(pickLocalizedText({}, "en"), null);
    assert.equal(pickLocalizedText(null, "en"), null);
  });

  it("uses custom fallback locale before default", () => {
    assert.equal(
      pickLocalizedText({ de: "Deutsch" }, "it", "de"),
      "Deutsch",
    );
  });
});
