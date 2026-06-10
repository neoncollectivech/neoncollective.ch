import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  areProfileContactsVerified,
  isProfileComplete,
  isProfileReadyForCheckout,
  type PersonRow,
} from "./profile";

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    givenName: "Ada",
    familyName: "Lovelace",
    email: "ada@neon.test",
    phone: null,
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    phoneVerifiedAt: null,
    ...overrides,
  };
}

describe("profile helpers", () => {
  describe("isProfileComplete", () => {
    it("requires real names and at least one contact field", () => {
      assert.equal(isProfileComplete(person()), true);
      assert.equal(isProfileComplete(person({ givenName: "" })), false);
      assert.equal(isProfileComplete(person({ familyName: "Guest" })), false);
      assert.equal(isProfileComplete(person({ email: null, phone: null })), false);
    });
  });

  describe("areProfileContactsVerified", () => {
    it("passes when email-only profile is verified", () => {
      assert.equal(areProfileContactsVerified(person()), true);
    });

    it("fails when email is present but unverified", () => {
      assert.equal(
        areProfileContactsVerified(person({ emailVerifiedAt: null })),
        false,
      );
    });

    it("passes when phone-only profile is verified", () => {
      assert.equal(
        areProfileContactsVerified(
          person({
            email: null,
            phone: "41791234567",
            emailVerifiedAt: null,
            phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        ),
        true,
      );
    });

    it("requires every present contact channel to be verified", () => {
      assert.equal(
        areProfileContactsVerified(
          person({
            phone: "41791234567",
            phoneVerifiedAt: null,
          }),
        ),
        false,
      );

      assert.equal(
        areProfileContactsVerified(
          person({
            phone: "41791234567",
            phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        ),
        true,
      );
    });
  });

  describe("isProfileReadyForCheckout", () => {
    it("requires complete profile and verified contacts", () => {
      assert.equal(isProfileReadyForCheckout(person()), true);
      assert.equal(
        isProfileReadyForCheckout(person({ emailVerifiedAt: null })),
        false,
      );
      assert.equal(isProfileReadyForCheckout(null), false);
      assert.equal(
        isProfileReadyForCheckout(person({ givenName: "Guest" })),
        false,
      );
    });
  });
});
