import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateEd25519AdmissionKeyPair,
  signAdmissionCredential,
  verifyAdmissionCredential,
} from "./admission-jwt";

describe("admission-jwt", () => {
  it("signs and verifies without exp", async () => {
    const material = await generateEd25519AdmissionKeyPair();
    const admissionId = "11111111-1111-4111-8111-111111111111";
    const eventId = "22222222-2222-4222-8222-222222222222";
    const orderId = "33333333-3333-4333-8333-333333333333";
    const tierIds = ["44444444-4444-4444-8444-444444444444"];

    const credential = await signAdmissionCredential({
      admissionId,
      eventId,
      orderId,
      tierIds,
      kid: material.kid,
      privateJwk: material.privateJwk,
    });

    assert.ok(credential.startsWith("eyJ"));

    const verified = await verifyAdmissionCredential({
      credential,
      kid: material.kid,
      publicJwk: material.publicJwk,
      expectedEventId: eventId,
    });

    assert.ok(verified);
    assert.equal(verified?.admissionId, admissionId);
    assert.equal(verified?.orderId, orderId);
    assert.deepEqual(verified?.tierIds, tierIds);
  });

  it("rejects wrong event", async () => {
    const material = await generateEd25519AdmissionKeyPair();
    const credential = await signAdmissionCredential({
      admissionId: "11111111-1111-4111-8111-111111111111",
      eventId: "22222222-2222-4222-8222-222222222222",
      orderId: "33333333-3333-4333-8333-333333333333",
      tierIds: [],
      kid: material.kid,
      privateJwk: material.privateJwk,
    });

    const verified = await verifyAdmissionCredential({
      credential,
      kid: material.kid,
      publicJwk: material.publicJwk,
      expectedEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    assert.equal(verified, null);
  });
});
