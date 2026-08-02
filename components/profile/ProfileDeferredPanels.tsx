"use client";

import dynamic from "next/dynamic";
import type { UserInsightsResult } from "@/services/analytics/types";
import type { NotificationPreferencesSnapshot } from "@/components/profile/NotificationPreferencesPanel";

const panelFallback = (
  <div className="card p-6 mt-6 animate-pulse h-24 bg-muted/40" aria-hidden />
);

const UserInsightsPanel = dynamic(
  () =>
    import("@/components/profile/UserInsightsPanel").then(
      (m) => m.UserInsightsPanel
    ),
  { loading: () => panelFallback }
);
const PhoneVerificationPanel = dynamic(
  () =>
    import("@/components/profile/PhoneVerificationPanel").then(
      (m) => m.PhoneVerificationPanel
    ),
  { loading: () => panelFallback }
);
const ProfileEditor = dynamic(
  () =>
    import("@/components/profile/ProfileEditor").then((m) => m.ProfileEditor),
  { loading: () => panelFallback }
);
const LanguagePreferencesPanel = dynamic(
  () =>
    import("@/components/profile/LanguagePreferencesPanel").then(
      (m) => m.LanguagePreferencesPanel
    ),
  { loading: () => panelFallback }
);
const NotificationPreferencesPanel = dynamic(
  () =>
    import("@/components/profile/NotificationPreferencesPanel").then(
      (m) => m.NotificationPreferencesPanel
    ),
  { loading: () => panelFallback }
);
const PrivacySettingsPanel = dynamic(
  () =>
    import("@/components/legal/PrivacySettingsPanel").then(
      (m) => m.PrivacySettingsPanel
    ),
  { loading: () => panelFallback }
);

export function ProfileDeferredPanels({
  insights,
  phone,
  phoneVerified,
  userId,
  name,
  profilePicture,
  notificationPreferences,
}: {
  insights: UserInsightsResult | null;
  phone: string | null;
  phoneVerified: boolean;
  userId: string;
  name: string;
  profilePicture: string | null;
  notificationPreferences: NotificationPreferencesSnapshot;
}) {
  return (
    <>
      <UserInsightsPanel initialInsights={insights} />
      <PhoneVerificationPanel
        initialPhone={phone}
        phoneVerified={phoneVerified}
      />
      <ProfileEditor
        initial={{
          name,
          profilePicture,
        }}
        userId={userId}
      />
      <LanguagePreferencesPanel />
      <NotificationPreferencesPanel
        initialPreferences={notificationPreferences}
      />
      <PrivacySettingsPanel />
    </>
  );
}
