import { computeTrustScore } from "@/lib/trust-score";
import type { TrustRankTier } from "@prisma/client";

export type TrustRankInput = {
  sharedIntroducerCount: number;
  connectionDegree: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  trustedUser?: boolean;
  successfulIntroductions?: number;
  sharedWeight?: number;
};

export type TrustRankResult = {
  score: number;
  rank: number;
  tier: TrustRankTier;
  breakdown: {
    sharedIntroducers: number;
    verification: number;
    introductions: number;
    networkDepth: number;
  };
};

/**
 * Trust network ranking formula:
 * 70% shared introducers · 15% verification · 10% successful introductions · 5% network depth
 */
export function calculateTrustRank(input: TrustRankInput): TrustRankResult {
  const sharedScore = Math.min(100, input.sharedIntroducerCount * 10);
  const verifiedCount = [
    input.emailVerified,
    input.phoneVerified,
    input.identityVerified,
    input.trustedUser,
  ].filter(Boolean).length;
  const verificationScore = (verifiedCount / 4) * 100;
  const introScore = Math.min(100, (input.successfulIntroductions ?? 0) * 8);
  const depthScore = Math.max(0, 100 - (input.connectionDegree - 1) * 25);

  const score = Math.round(
    sharedScore * 0.7 +
      verificationScore * 0.15 +
      introScore * 0.1 +
      depthScore * 0.05
  );

  const rank = Math.max(0, Math.min(100, score));
  const tier = trustRankTierFromScore(rank);

  return {
    score: rank,
    rank,
    tier,
    breakdown: {
      sharedIntroducers: Math.round(sharedScore * 0.7),
      verification: Math.round(verificationScore * 0.15),
      introductions: Math.round(introScore * 0.1),
      networkDepth: Math.round(depthScore * 0.05),
    },
  };
}

export function trustRankTierFromScore(score: number): TrustRankTier {
  if (score >= 90) return "diamond";
  if (score >= 75) return "platinum";
  if (score >= 60) return "gold";
  if (score >= 40) return "silver";
  return "bronze";
}

export function trustRankTierLabel(tier: TrustRankTier): string {
  const map: Record<TrustRankTier, string> = {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
    platinum: "Platinum",
    diamond: "Diamond",
  };
  return map[tier];
}

/** Legacy composite score — delegates to existing formula for backwards compatibility. */
export function legacyTrustScore(input: TrustRankInput): number {
  return computeTrustScore({
    sharedIntroducerCount: input.sharedIntroducerCount,
    connectionDegree: input.connectionDegree,
    emailVerified: input.emailVerified,
    phoneVerified: input.phoneVerified,
    identityVerified: input.identityVerified,
    sharedWeight: input.sharedWeight,
  });
}
