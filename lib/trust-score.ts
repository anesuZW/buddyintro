/** Trust score and level — shared introducers dominate (70%). */

export type TrustLevel =
  | "unverified"
  | "familiar"
  | "trusted"
  | "highly_trusted"
  | "deeply_trusted";

export type TrustLevelLabel =
  | "Unverified Connection"
  | "Familiar Connection"
  | "Trusted Connection"
  | "Highly Trusted"
  | "Deeply Trusted Network";

export function sharedIntroducerBaseScore(count: number): number {
  if (count >= 10) return 95;
  if (count >= 5) return 75;
  if (count >= 3) return 55;
  if (count >= 1) return 30;
  return 10;
}

export function trustLevelFromSharedCount(count: number): TrustLevel {
  if (count >= 10) return "deeply_trusted";
  if (count >= 6) return "highly_trusted";
  if (count >= 3) return "trusted";
  if (count >= 1) return "familiar";
  return "unverified";
}

export function trustLevelLabel(level: TrustLevel): TrustLevelLabel {
  const map: Record<TrustLevel, TrustLevelLabel> = {
    unverified: "Unverified Connection",
    familiar: "Familiar Connection",
    trusted: "Trusted Connection",
    highly_trusted: "Highly Trusted",
    deeply_trusted: "Deeply Trusted Network",
  };
  return map[level];
}

/** Composite trust score: 70% shared introducers, 15% verification, 10% network, 5% engagement */
export function computeTrustScore(args: {
  sharedIntroducerCount: number;
  connectionDegree?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  engagementScore?: number;
  sharedWeight?: number;
}): number {
  const sharedWeight = args.sharedWeight ?? 70;
  const remaining = 100 - sharedWeight;
  const verificationWeight = Math.round(remaining * 0.5);
  const networkWeight = Math.round(remaining * 0.33);
  const engagementWeight = remaining - verificationWeight - networkWeight;

  const sharedScore = sharedIntroducerBaseScore(args.sharedIntroducerCount);
  const verifiedCount = [
    args.emailVerified,
    args.phoneVerified,
    args.identityVerified,
  ].filter(Boolean).length;
  const verificationScore = (verifiedCount / 3) * 100;
  const degree = args.connectionDegree ?? 1;
  const networkScore = Math.max(0, 100 - (degree - 1) * 25);
  const engagementScore = Math.min(100, args.engagementScore ?? 0);

  const score =
    (sharedScore * sharedWeight +
      verificationScore * verificationWeight +
      networkScore * networkWeight +
      engagementScore * engagementWeight) /
    100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function userPair(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}
