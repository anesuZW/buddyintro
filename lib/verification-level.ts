import type { VerificationLevel } from "@prisma/client";

export type VerificationUser = {
  phoneVerified: boolean;
  emailVerified: boolean;
  identityVerified: boolean;
  trustedUser: boolean;
  verificationLevel?: VerificationLevel;
};

/** Derive canonical verification level from user flags (single source of truth). */
export function computeVerificationLevel(user: VerificationUser): VerificationLevel {
  if (user.trustedUser) return "trusted";
  if (user.identityVerified) return "identity";
  if (user.emailVerified) return "email";
  if (user.phoneVerified) return "phone";
  return "none";
}

export function verificationLevelLabel(level: VerificationLevel): string {
  const map: Record<VerificationLevel, string> = {
    none: "Unverified",
    phone: "Phone verified",
    email: "Email verified",
    identity: "Identity verified",
    trusted: "Trusted member",
  };
  return map[level];
}

export function isVerifiedForDiscovery(user: VerificationUser): boolean {
  const level = computeVerificationLevel(user);
  return level !== "none";
}

export function meetsVerificationLevel(
  user: VerificationUser,
  required: "phone" | "email" | "identity" | "trusted"
): boolean {
  const order: VerificationLevel[] = ["none", "phone", "email", "identity", "trusted"];
  const current = computeVerificationLevel(user);
  return order.indexOf(current) >= order.indexOf(required);
}
