import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  admissionKidForEvent,
  generateEd25519AdmissionKeyPair,
  signAdmissionCredential,
  verifyAdmissionCredential,
} from "./admission-jwt";

describe("admission-jwt", () => {
  it("signs and verifies minimal payload without exp", async () => {
    const material = await generateEd25519AdmissionKeyPair();
    const admissionId = "11111111-1111-4111-8111-111111111111";

    const credential = await signAdmissionCredential({
      admissionId,
      kid: material.kid,
      privateJwk: material.privateJwk,
    });

    assert.ok(credential.startsWith("eyJ"));
    assert.ok(
      credential.length < 400,
      `expected compact credential, got ${credential.length} chars`,
    );

    const verified = await verifyAdmissionCredential({
      credential,
      kid: material.kid,
      publicJwk: material.publicJwk,
    });

    assert.ok(verified);
    assert.equal(verified?.admissionId, admissionId);
  });

  it("rejects wrong signing key", async () => {
    const material = await generateEd25519AdmissionKeyPair();
    const other = await generateEd25519AdmissionKeyPair();
    const credential = await signAdmissionCredential({
      admissionId: "11111111-1111-4111-8111-111111111111",
      kid: material.kid,
      privateJwk: material.privateJwk,
    });

    const verified = await verifyAdmissionCredential({
      credential,
      kid: other.kid,
      publicJwk: other.publicJwk,
    });

    assert.equal(verified, null);
  });

  it("uses short kid for event", () => {
    const eventId = "22222222-2222-4222-8222-222222222222";
    const kid = admissionKidForEvent(eventId);

    assert.ok(kid.startsWith("e"));
    assert.ok(kid.length < 28);
    assert.equal(kid, admissionKidForEvent(eventId));
  });
});
