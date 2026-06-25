import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTrustScore,
  sharedIntroducerBaseScore,
  trustLevelFromSharedCount,
} from "../lib/trust-score";

describe("trust score calculations", () => {
  it("increases score with shared introducers", () => {
    assert.ok(sharedIntroducerBaseScore(0) < sharedIntroducerBaseScore(5));
    assert.ok(sharedIntroducerBaseScore(5) < sharedIntroducerBaseScore(10));
  });

  it("maps shared count to trust levels", () => {
    assert.equal(trustLevelFromSharedCount(0), "unverified");
    assert.equal(trustLevelFromSharedCount(3), "trusted");
    assert.equal(trustLevelFromSharedCount(10), "deeply_trusted");
  });

  it("computeTrustScore favors shared introducers over verification alone", () => {
    const shared = computeTrustScore({ sharedIntroducerCount: 8, connectionDegree: 1 });
    const verifiedOnly = computeTrustScore({
      sharedIntroducerCount: 0,
      connectionDegree: 1,
      emailVerified: true,
      phoneVerified: true,
      identityVerified: true,
    });
    assert.ok(shared > verifiedOnly);
  });
});
