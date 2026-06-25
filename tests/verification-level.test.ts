import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeVerificationLevel,
  isVerifiedForDiscovery,
  meetsVerificationLevel,
} from "../lib/verification-level";

describe("verification level and discovery visibility", () => {
  it("derives trusted > identity > email > phone > none", () => {
    assert.equal(
      computeVerificationLevel({
        trustedUser: true,
        identityVerified: true,
        emailVerified: true,
        phoneVerified: true,
      }),
      "trusted"
    );

    assert.equal(
      computeVerificationLevel({
        trustedUser: false,
        identityVerified: false,
        emailVerified: true,
        phoneVerified: true,
      }),
      "email"
    );
  });

  it("blocks unverified users from discovery visibility", () => {
    assert.equal(
      isVerifiedForDiscovery({
        trustedUser: false,
        identityVerified: false,
        emailVerified: false,
        phoneVerified: false,
      }),
      false
    );

    assert.equal(
      isVerifiedForDiscovery({
        trustedUser: false,
        identityVerified: false,
        emailVerified: false,
        phoneVerified: true,
      }),
      true
    );
  });

  it("meetsVerificationLevel respects ordering", () => {
    const user = {
      trustedUser: false,
      identityVerified: false,
      emailVerified: true,
      phoneVerified: true,
    };
    assert.equal(meetsVerificationLevel(user, "phone"), true);
    assert.equal(meetsVerificationLevel(user, "identity"), false);
  });
});
