import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { AdminSettings } from "@prisma/client";
import { logAdminAction } from "@/services/audit-log";
import { normalizeVisibilityAdminPatch } from "@/lib/story-visibility-shared";

const VISIBILITY_KEYS = new Set([
  "enableSpecificPeopleVisibility",
  "enableMutualIntroductionNetworkVisibility",
  "enableEveryoneIntroducedVisibility",
  "defaultStoryVisibilityMode",
  "allowUserVisibilitySelection",
]);

const DEFAULTS = {
  inviteGateEnabled: false,
  requiredInvites: 2,
  storyExpiryHours: 24,
  postExpiryHours: 48,
  discoveriesEnabled: true,
  discoveriesExpiryHours: 24 as number | null,
  discoveriesPublicEnabled: false,
  introductionsNeverExpire: false,
  discoveriesNetworkDepth: 2,
  showConnectionReasons: true,
  enableIntroductionGraph: true,
  allowFirstDegreeDiscovery: true,
  allowSecondDegreeDiscovery: true,
  allowThirdDegreeDiscovery: false,
  allowFourthDegreeDiscovery: false,
  maxDiscoveryDepth: 2,
  showConnectionPaths: true,
  enableTrustScores: true,
  enableVerificationLayer: true,
  enableIntroductionCategories: true,
  allowUserCreatedCategories: false,
  allowCategoryEditing: true,
  requirePhoneVerification: false,
  requireIdentityVerification: false,
  showTrustScores: true,
  showSharedIntroducers: true,
  enableSharedIntroducerTrust: true,
  showSharedIntroducerCounts: true,
  sharedIntroducerWeight: 70,
  minimumSharedIntroducersForMessaging: 0,
  minimumSharedIntroducersForDiscovery: 0,
  enableNotifications: true,
  enableInAppNotifications: true,
  enablePushNotifications: true,
  enableEmailNotifications: true,
  enableIntroductionNotifications: true,
  enableDiscoveryNotifications: true,
  enableMessageNotifications: true,
  enableTrustNotifications: true,
  enableVerificationNotifications: true,
  enableAnnouncementNotifications: true,
  enableIntroductionViewNotifications: false,
  enableNotificationDigests: false,
  notificationDigestFrequency: "instant" as const,
  enableDiscoveryControls: false,
  enableGranularVerificationGates: false,
  enableBackgroundJobs: false,
  enableTrustRankings: true,
  enableTrustRecommendations: true,
  allowCrossCategoryDiscovery: true,
  allowDiscoveryMessaging: true,
  requireSharedIntroducerForDiscovery: false,
  requireSharedIntroducerForMessaging: false,
  hideDiscoveryFromUnverifiedUsers: false,
  requireEmailVerification: false,
  messagingRequirePhone: false,
  messagingRequireEmail: false,
  messagingRequireIdentity: false,
  discoveriesRequirePhone: false,
  discoveriesRequireEmail: false,
  discoveriesRequireIdentity: false,
  introductionsRequirePhone: false,
  introductionsRequireEmail: false,
  introductionsRequireIdentity: false,
  enableSpecificPeopleVisibility: false,
  enableMutualIntroductionNetworkVisibility: true,
  enableEveryoneIntroducedVisibility: false,
  defaultStoryVisibilityMode: "mutual_introduction_network" as const,
  allowUserVisibilitySelection: true,
  enableDiscoveriesHeroBanner: true,
  enableDiscoveryExpiryIndicators: true,
  enableDiscoveryTrustContext: true,
};

/** Cross-request TTL cache — admin settings change rarely; avoids ~1 query per navigation. */
const SETTINGS_TTL_MS = 60_000;
let settingsCache: { value: AdminSettings; expires: number } | null = null;

async function loadAdminSettings(): Promise<AdminSettings> {
  const existing = await prisma.adminSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.adminSettings.create({ data: { id: 1, ...DEFAULTS } });
}

/** Per-request dedupe via React.cache + cross-request TTL for hot paths. */
export const getAdminSettings = cache(async (): Promise<AdminSettings> => {
  const now = Date.now();
  if (settingsCache && settingsCache.expires > now) {
    return settingsCache.value;
  }
  const value = await loadAdminSettings();
  settingsCache = { value, expires: now + SETTINGS_TTL_MS };
  return value;
});

/** Invalidate after admin PATCH so next read is fresh. */
export function invalidateAdminSettingsCache() {
  settingsCache = null;
}

export async function updateAdminSettings(
  input: Partial<Omit<AdminSettings, "id" | "updatedAt">>,
  audit?: { adminId: string; ipAddress?: string | null }
) {
  const current = await getAdminSettings();
  const hasVisibilityPatch = Object.keys(input).some((k) => VISIBILITY_KEYS.has(k));
  const data = hasVisibilityPatch ? normalizeVisibilityAdminPatch(current, input) : input;

  const updated = await prisma.adminSettings.update({
    where: { id: 1 },
    data,
  });

  invalidateAdminSettingsCache();

  if (audit) {
    await logAdminAction({
      adminId: audit.adminId,
      action: "admin_settings_update",
      targetType: "admin_settings",
      targetId: "1",
      metadata: { keys: Object.keys(input) },
      ipAddress: audit.ipAddress,
    });
  }

  return updated;
}
