import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicAdmissionListItem } from "./admissions.service";

describe("PublicAdmissionListItem", () => {
  it("excludes signed credentials from the public list shape", () => {
    const sample: PublicAdmissionListItem = {
      id: "11111111-1111-4111-8111-111111111111",
      givenName: "Alex",
      familyName: "Guest",
      tierName: "Standard",
      checkedInAt: null,
      revokedAt: null,
    };

    assert.equal("credential" in sample, false);
    assert.deepEqual(Object.keys(sample).sort(), [
      "checkedInAt",
      "familyName",
      "givenName",
      "id",
      "revokedAt",
      "tierName",
    ]);
  });
});
