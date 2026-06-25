import { NextResponse } from "next/server";

import { z } from "zod";

import { requireAdminApi } from "@/lib/auth";

import { getAdminSettings, updateAdminSettings } from "@/services/admin";



export async function GET() {

  const admin = await requireAdminApi();

  if (admin instanceof NextResponse) return admin;

  const settings = await getAdminSettings();

  return NextResponse.json({ settings });

}



const Schema = z.object({

  inviteGateEnabled: z.boolean().optional(),

  requiredInvites: z.number().int().min(0).max(50).optional(),

  storyExpiryHours: z.number().int().min(1).max(72).optional(),

  postExpiryHours: z.number().int().min(1).max(168).optional(),

  discoveriesEnabled: z.boolean().optional(),

  discoveriesExpiryHours: z.number().int().min(0).max(8760).nullable().optional(),

  discoveriesPublicEnabled: z.boolean().optional(),

  introductionsNeverExpire: z.boolean().optional(),

  discoveriesNetworkDepth: z.number().int().min(1).max(4).optional(),

  showConnectionReasons: z.boolean().optional(),

  enableIntroductionGraph: z.boolean().optional(),

  allowFirstDegreeDiscovery: z.boolean().optional(),

  allowSecondDegreeDiscovery: z.boolean().optional(),

  allowThirdDegreeDiscovery: z.boolean().optional(),

  allowFourthDegreeDiscovery: z.boolean().optional(),

  maxDiscoveryDepth: z.number().int().min(1).max(4).optional(),

  showConnectionPaths: z.boolean().optional(),
  enableTrustScores: z.boolean().optional(),
  enableVerificationLayer: z.boolean().optional(),
  enableIntroductionCategories: z.boolean().optional(),
  allowUserCreatedCategories: z.boolean().optional(),
  allowCategoryEditing: z.boolean().optional(),
  requirePhoneVerification: z.boolean().optional(),
  requireIdentityVerification: z.boolean().optional(),
  showTrustScores: z.boolean().optional(),
  showSharedIntroducers: z.boolean().optional(),
  enableSharedIntroducerTrust: z.boolean().optional(),
  showSharedIntroducerCounts: z.boolean().optional(),
  sharedIntroducerWeight: z.number().int().min(0).max(100).optional(),
  minimumSharedIntroducersForMessaging: z.number().int().min(0).max(50).optional(),
  minimumSharedIntroducersForDiscovery: z.number().int().min(0).max(50).optional(),
  enableNotifications: z.boolean().optional(),
  enableInAppNotifications: z.boolean().optional(),
  enablePushNotifications: z.boolean().optional(),
  enableEmailNotifications: z.boolean().optional(),
  enableIntroductionNotifications: z.boolean().optional(),
  enableDiscoveryNotifications: z.boolean().optional(),
  enableMessageNotifications: z.boolean().optional(),
  enableTrustNotifications: z.boolean().optional(),
  enableVerificationNotifications: z.boolean().optional(),
  enableAnnouncementNotifications: z.boolean().optional(),
  enableIntroductionViewNotifications: z.boolean().optional(),
  enableNotificationDigests: z.boolean().optional(),
  notificationDigestFrequency: z.enum(["instant", "daily", "weekly"]).optional(),
  enableDiscoveryControls: z.boolean().optional(),
  enableGranularVerificationGates: z.boolean().optional(),
  enableBackgroundJobs: z.boolean().optional(),
  enableTrustRankings: z.boolean().optional(),
  enableTrustRecommendations: z.boolean().optional(),
  allowCrossCategoryDiscovery: z.boolean().optional(),
  allowDiscoveryMessaging: z.boolean().optional(),
  requireSharedIntroducerForDiscovery: z.boolean().optional(),
  requireSharedIntroducerForMessaging: z.boolean().optional(),
  hideDiscoveryFromUnverifiedUsers: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  messagingRequirePhone: z.boolean().optional(),
  messagingRequireEmail: z.boolean().optional(),
  messagingRequireIdentity: z.boolean().optional(),
  discoveriesRequirePhone: z.boolean().optional(),
  discoveriesRequireEmail: z.boolean().optional(),
  discoveriesRequireIdentity: z.boolean().optional(),
  introductionsRequirePhone: z.boolean().optional(),
  introductionsRequireEmail: z.boolean().optional(),
  introductionsRequireIdentity: z.boolean().optional(),
  enableSpecificPeopleVisibility: z.boolean().optional(),
  enableMutualIntroductionNetworkVisibility: z.boolean().optional(),
  enableEveryoneIntroducedVisibility: z.boolean().optional(),
  defaultStoryVisibilityMode: z
    .enum([
      "specific_people_only",
      "mutual_introduction_network",
      "everyone_i_have_introduced",
    ])
    .optional(),
  allowUserVisibilitySelection: z.boolean().optional(),
  enableDiscoveriesHeroBanner: z.boolean().optional(),
  enableDiscoveryExpiryIndicators: z.boolean().optional(),
  enableDiscoveryTrustContext: z.boolean().optional(),
});



export async function PATCH(request: Request) {

  const admin = await requireAdminApi();

  if (admin instanceof NextResponse) return admin;

  const data = Schema.parse(await request.json());

  const forwarded = request.headers.get("x-forwarded-for");
  const settings = await updateAdminSettings(data, {
    adminId: admin.id,
    ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ settings });

}

