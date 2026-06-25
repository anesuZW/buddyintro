import "server-only";

import { prisma } from "@/lib/prisma";
import { computeVerificationLevel } from "@/lib/verification-level";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { notifyVerification } from "@/services/notifications/emitters";
import { syncUserVerificationLevel } from "@/lib/verification-gates";

export async function syncEmailVerificationFromAuth(userId: string, emailConfirmed: boolean) {
  if (!emailConfirmed) return null;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });
  await syncUserVerificationLevel(userId);
  return updated;
}

export async function grantTrustedUser(userId: string, trusted: boolean) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { trustedUser: trusted },
  });
  await syncUserVerificationLevel(userId);
  if (trusted) {
    void analyticsService.track({
      userId,
      eventType: ANALYTICS_EVENTS.VERIFICATION_COMPLETED,
      metadata: { level: "trusted" },
    });
    void notifyVerification({ userId, kind: "approved" }).catch(() => {});
  }
  return user;
}

export async function setIdentityVerified(userId: string, verified: boolean) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { identityVerified: verified },
  });
  await syncUserVerificationLevel(userId);
  if (verified) {
    void analyticsService.track({
      userId,
      eventType: ANALYTICS_EVENTS.IDENTITY_VERIFIED,
      entityType: "user",
      entityId: userId,
    });
    void notifyVerification({ userId, kind: "identity" }).catch(() => {});
  }
  return user;
}

export type VerificationProfile = {
  phoneVerified: boolean;
  emailVerified: boolean;
  identityVerified: boolean;
  trustedUser: boolean;
  verificationLevel: ReturnType<typeof computeVerificationLevel>;
  verifiedAt: Date | null;
};

export async function getVerificationProfile(userId: string): Promise<VerificationProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phoneVerified: true,
      emailVerified: true,
      identityVerified: true,
      trustedUser: true,
      verificationLevel: true,
      verifiedAt: true,
    },
  });
  if (!user) return null;
  return {
    ...user,
    verificationLevel: computeVerificationLevel(user),
  };
}

export async function recordVerificationCompleted(
  userId: string,
  metadata?: Record<string, unknown>
) {
  void analyticsService.track({
    userId,
    eventType: ANALYTICS_EVENTS.VERIFICATION_COMPLETED,
    entityType: "user",
    entityId: userId,
    metadata,
  });
}
