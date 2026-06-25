import "server-only";

import type { AdminSettings, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSettings } from "@/services/admin";
import { isUserBlocked, listBlockedUserIds } from "@/services/moderation";
import { computeVerificationLevel, isVerifiedForDiscovery } from "@/lib/verification-level";
import { getSharedIntroducerCount } from "@/lib/shared-introducers";

export type VerificationGateAction =
  | "message"
  | "create_introduction"
  | "create_discovery"
  | "view_trust";

export type GateResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status: number };

type GateUser = Pick<
  User,
  | "id"
  | "phoneVerified"
  | "emailVerified"
  | "identityVerified"
  | "trustedUser"
  | "verificationLevel"
  | "suspendedAt"
>;

function legacyGateRequirements(
  settings: AdminSettings,
  action: VerificationGateAction,
  user: GateUser
): GateResult | null {
  if (settings.requirePhoneVerification && !user.phoneVerified) {
    if (action === "message" || action === "create_introduction" || action === "create_discovery") {
      return {
        ok: false,
        code: "phone_verification_required",
        message: "Verify your phone number before using this feature.",
        status: 403,
      };
    }
  }
  if (settings.requireEmailVerification && !user.emailVerified) {
    if (action === "message" || action === "create_introduction" || action === "create_discovery") {
      return {
        ok: false,
        code: "email_verification_required",
        message: "Verify your email before using this feature.",
        status: 403,
      };
    }
  }
  if (settings.requireIdentityVerification && !user.identityVerified) {
    if (action === "message" || action === "create_introduction") {
      return {
        ok: false,
        code: "identity_verification_required",
        message: "Identity verification is required for this action.",
        status: 403,
      };
    }
  }
  return null;
}

function granularRequirements(
  settings: AdminSettings,
  action: VerificationGateAction,
  user: GateUser
): GateResult | null {
  const map = {
    message: {
      phone: settings.messagingRequirePhone,
      email: settings.messagingRequireEmail,
      identity: settings.messagingRequireIdentity,
    },
    create_discovery: {
      phone: settings.discoveriesRequirePhone,
      email: settings.discoveriesRequireEmail,
      identity: settings.discoveriesRequireIdentity,
    },
    create_introduction: {
      phone: settings.introductionsRequirePhone,
      email: settings.introductionsRequireEmail,
      identity: settings.introductionsRequireIdentity,
    },
    view_trust: { phone: false, email: false, identity: false },
  } as const;

  const req = map[action];
  if (req.phone && !user.phoneVerified) {
    return {
      ok: false,
      code: "phone_verification_required",
      message: "Phone verification is required for this action.",
      status: 403,
    };
  }
  if (req.email && !user.emailVerified) {
    return {
      ok: false,
      code: "email_verification_required",
      message: "Email verification is required for this action.",
      status: 403,
    };
  }
  if (req.identity && !user.identityVerified && !user.trustedUser) {
    return {
      ok: false,
      code: "identity_verification_required",
      message: "Identity verification is required for this action.",
      status: 403,
    };
  }
  return null;
}

export async function checkVerificationGate(
  user: GateUser,
  action: VerificationGateAction
): Promise<GateResult> {
  if (user.suspendedAt) {
    return {
      ok: false,
      code: "account_suspended",
      message: "Your account is suspended. Contact support if you believe this is an error.",
      status: 403,
    };
  }

  const settings = await getAdminSettings();
  if (!settings.enableVerificationLayer) return { ok: true };

  const result = settings.enableGranularVerificationGates
    ? granularRequirements(settings, action, user)
    : legacyGateRequirements(settings, action, user);

  if (result) return result;
  return { ok: true };
}

export async function checkSharedIntroducerGate(
  viewerId: string,
  otherUserId: string,
  kind: "discovery" | "messaging"
): Promise<GateResult> {
  const settings = await getAdminSettings();
  if (!settings.enableDiscoveryControls) return { ok: true };

  const required =
    kind === "discovery"
      ? settings.requireSharedIntroducerForDiscovery
      : settings.requireSharedIntroducerForMessaging;
  const minimum =
    kind === "discovery"
      ? settings.minimumSharedIntroducersForDiscovery
      : settings.minimumSharedIntroducersForMessaging;

  if (!required && minimum <= 0) return { ok: true };

  const count = await getSharedIntroducerCount(viewerId, otherUserId);
  if (count < minimum) {
    return {
      ok: false,
      code: "insufficient_shared_introducers",
      message: `You need at least ${minimum} shared introducer(s) to ${kind === "discovery" ? "discover" : "message"} this person.`,
      status: 403,
    };
  }
  return { ok: true };
}

export async function checkMessagingAllowed(
  senderId: string,
  receiverId: string,
  sender: GateUser
): Promise<GateResult> {
  const settings = await getAdminSettings();
  const verification = await checkVerificationGate(sender, "message");
  if (!verification.ok) return verification;

  if (settings.enableDiscoveryControls && !settings.allowDiscoveryMessaging) {
    return {
      ok: false,
      code: "discovery_messaging_disabled",
      message: "Messaging from discoveries is temporarily disabled.",
      status: 403,
    };
  }

  const sharedGate = await checkSharedIntroducerGate(senderId, receiverId, "messaging");
  if (!sharedGate.ok) return sharedGate;

  if (await isUserBlocked(senderId, receiverId)) {
    return {
      ok: false,
      code: "blocked",
      message: "You cannot message this user.",
      status: 403,
    };
  }

  return { ok: true };
}

export async function filterDiscoveryAuthorIds(
  viewerId: string,
  authorIds: string[],
  viewer: GateUser
): Promise<string[]> {
  const settings = await getAdminSettings();
  if (!settings.enableDiscoveryControls) return authorIds;

  const blocked = new Set(await listBlockedUserIds(viewerId));
  let filtered = authorIds.filter((id) => id !== viewerId && !blocked.has(id));

  if (settings.hideDiscoveryFromUnverifiedUsers && !isVerifiedForDiscovery(viewer)) {
    return [];
  }

  if (settings.requireSharedIntroducerForDiscovery || settings.minimumSharedIntroducersForDiscovery > 0) {
    const checks = await Promise.all(
      filtered.map(async (authorId) => {
        const gate = await checkSharedIntroducerGate(viewerId, authorId, "discovery");
        return gate.ok ? authorId : null;
      })
    );
    filtered = checks.filter((id): id is string => Boolean(id));
  }

  return filtered;
}

export async function syncUserVerificationLevel(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phoneVerified: true,
      emailVerified: true,
      identityVerified: true,
      trustedUser: true,
    },
  });
  if (!user) return null;

  const verificationLevel = computeVerificationLevel(user);
  return prisma.user.update({
    where: { id: userId },
    data: {
      verificationLevel,
      verifiedAt: verificationLevel === "none" ? null : new Date(),
    },
  });
}

export async function getVerificationStatus(userId: string) {
  const settings = await getAdminSettings();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phoneVerified: true,
      emailVerified: true,
      identityVerified: true,
      trustedUser: true,
      verificationLevel: true,
      verifiedAt: true,
      phone: true,
      suspendedAt: true,
    },
  });
  return { user, settings };
}
