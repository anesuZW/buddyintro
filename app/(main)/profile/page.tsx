import { requireUser } from "@/lib/auth";
import { getTrustRecommendations } from "@/services/trust-recommendations";
import { Avatar } from "@/components/ui/Avatar";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { PrivacySettingsPanel } from "@/components/legal/PrivacySettingsPanel";
import { TrustNetworkSection } from "@/components/profile/TrustNetworkSection";
import { UserInsightsPanel } from "@/components/profile/UserInsightsPanel";
import { TrustedUserBadge } from "@/components/trust/TrustedUserBadge";
import { TrustRecommendationsPanel } from "@/components/trust/TrustRecommendationsPanel";
import {
  NotificationPreferencesPanel,
  type NotificationPreferencesSnapshot,
} from "@/components/profile/NotificationPreferencesPanel";
import { PhoneVerificationPanel } from "@/components/profile/PhoneVerificationPanel";
import { getProfileTrustNetwork } from "@/services/trust-network";
import { analyticsService } from "@/services/analytics/analytics-service";
import { notificationService } from "@/services/notifications/notification-service";
import { runWithPerf } from "@/lib/perf/context";

function toNotificationPreferencesSnapshot(
  prefs: Awaited<ReturnType<typeof notificationService.getPreferences>>
): NotificationPreferencesSnapshot {
  return {
    enableNotifications: prefs.enableNotifications,
    enableIntroductionNotifications: prefs.enableIntroductionNotifications,
    enableInvitationNotifications: prefs.enableInvitationNotifications,
    enableDiscoveryNotifications: prefs.enableDiscoveryNotifications,
    enableMessageNotifications: prefs.enableMessageNotifications,
    enableTrustNotifications: prefs.enableTrustNotifications,
    enableVerificationNotifications: prefs.enableVerificationNotifications,
    enableEmailNotifications: prefs.enableEmailNotifications,
    enablePushNotifications: prefs.enablePushNotifications,
    enableInAppNotifications: prefs.enableInAppNotifications,
    quietHoursEnabled: prefs.quietHoursEnabled,
    quietHoursStart: prefs.quietHoursStart,
    quietHoursEnd: prefs.quietHoursEnd,
  };
}

export default async function ProfilePage() {
  return runWithPerf({ kind: "page", label: "/profile" }, async () => {
    const user = await requireUser();
    const [trustNetwork, recommendations, insights, notificationPreferences] = await Promise.all([
      getProfileTrustNetwork(user.id, user.id),
      getTrustRecommendations(user.id),
      analyticsService.queryUserInsights(user.id),
      notificationService.getPreferences(user.id),
    ]);

    return (
      <div className="px-4 py-6">
        <div className="card p-6 flex flex-col items-center text-center bg-fi-card border-primary/10">
          <Avatar src={user.profilePicture} name={user.name} size="xl" ring />

          <h1 className="mt-4 text-xl font-bold">{user.name}</h1>

          <div className="mt-2">
            <TrustedUserBadge
              trustedUser={user.trustedUser}
              verificationLevel={user.verificationLevel}
            />
          </div>

          <p className="text-sm text-muted-foreground">{user.email}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 w-full">
            <div className="rounded-2xl bg-muted p-4 text-center">
              <div className="text-2xl font-bold">{trustNetwork.stats.peopleYouIntroduced}</div>
              <div className="text-xs text-muted-foreground">People introduced</div>
            </div>

            <div className="rounded-2xl bg-muted p-4 text-center">
              <div className="text-2xl font-bold">{trustNetwork.stats.peopleIntroducedToYou}</div>
              <div className="text-xs text-muted-foreground">Introduced to you</div>
            </div>
          </div>
        </div>

        <TrustNetworkSection data={trustNetwork} viewerId={user.id} profileUserId={user.id} />

        <div className="mt-6">
          <TrustRecommendationsPanel
            title="Grow your trust network"
            initialRecommendations={recommendations}
          />
        </div>

        <UserInsightsPanel initialInsights={insights} />

        <PhoneVerificationPanel
          initialPhone={user.phone}
          phoneVerified={user.phoneVerified}
        />

        <ProfileEditor
          initial={{
            name: user.name,
            profilePicture: user.profilePicture,
          }}
          userId={user.id}
        />

        <NotificationPreferencesPanel
          initialPreferences={toNotificationPreferencesSnapshot(notificationPreferences)}
        />

        <PrivacySettingsPanel />

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    );
  });
}
