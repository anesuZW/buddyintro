import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateTrustRank, trustRankTierFromScore } from "../lib/trust-rank";

describe("calculateTrustRank", () => {
  it("weights shared introducers at 70%", () => {
    const high = calculateTrustRank({
      sharedIntroducerCount: 10,
      connectionDegree: 1,
      emailVerified: false,
      phoneVerified: false,
      identityVerified: false,
    });
    const low = calculateTrustRank({
      sharedIntroducerCount: 0,
      connectionDegree: 1,
      emailVerified: true,
      phoneVerified: true,
      identityVerified: true,
      trustedUser: true,
    });
    assert.ok(high.rank > low.rank);
    assert.ok(high.breakdown.sharedIntroducers > low.breakdown.sharedIntroducers);
  });

  it("assigns diamond tier at high scores", () => {
    assert.equal(trustRankTierFromScore(95), "diamond");
    assert.equal(trustRankTierFromScore(80), "platinum");
    assert.equal(trustRankTierFromScore(65), "gold");
    assert.equal(trustRankTierFromScore(45), "silver");
    assert.equal(trustRankTierFromScore(10), "bronze");
  });
});
