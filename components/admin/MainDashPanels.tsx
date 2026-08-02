"use client";

import dynamic from "next/dynamic";
import type { AdminSettings } from "@prisma/client";

const panelFallback = (
  <div className="card p-6 my-4 animate-pulse h-32 bg-muted/40" aria-hidden />
);

const AdminSettingsForm = dynamic(
  () =>
    import("@/components/admin/AdminSettingsForm").then(
      (m) => m.AdminSettingsForm
    ),
  { loading: () => panelFallback }
);
const StoryVisibilityAdmin = dynamic(
  () =>
    import("@/components/admin/StoryVisibilityAdmin").then(
      (m) => m.StoryVisibilityAdmin
    ),
  { loading: () => panelFallback }
);
const DiscoveriesUxAdmin = dynamic(
  () =>
    import("@/components/admin/DiscoveriesUxAdmin").then(
      (m) => m.DiscoveriesUxAdmin
    ),
  { loading: () => panelFallback }
);
const DiscoveryControlsAdmin = dynamic(
  () =>
    import("@/components/admin/DiscoveryControlsAdmin").then(
      (m) => m.DiscoveryControlsAdmin
    ),
  { loading: () => panelFallback }
);
const AdminTrustedUsersPanel = dynamic(
  () =>
    import("@/components/admin/AdminTrustedUsersPanel").then(
      (m) => m.AdminTrustedUsersPanel
    ),
  { loading: () => panelFallback }
);
const AnalyticsDashboard = dynamic(
  () =>
    import("@/components/admin/AnalyticsDashboard").then(
      (m) => m.AnalyticsDashboard
    ),
  { loading: () => panelFallback }
);
const AdminAnnouncements = dynamic(
  () =>
    import("@/components/admin/AdminAnnouncements").then(
      (m) => m.AdminAnnouncements
    ),
  { loading: () => panelFallback }
);
const AdminModerationPanel = dynamic(
  () =>
    import("@/components/admin/AdminModerationPanel").then(
      (m) => m.AdminModerationPanel
    ),
  { loading: () => panelFallback }
);
const IntroductionCategoriesAdmin = dynamic(
  () =>
    import("@/components/admin/IntroductionCategoriesAdmin").then(
      (m) => m.IntroductionCategoriesAdmin
    ),
  { loading: () => panelFallback }
);

export function MainDashPanels({ settings }: { settings: AdminSettings }) {
  return (
    <div className="mt-6 space-y-0">
      <AdminSettingsForm initial={settings} />
      <StoryVisibilityAdmin initial={settings} />
      <DiscoveriesUxAdmin initial={settings} />
      <DiscoveryControlsAdmin initial={settings} />
      <AdminTrustedUsersPanel />
      <AnalyticsDashboard />
      <AdminAnnouncements />
      <AdminModerationPanel />
      <IntroductionCategoriesAdmin />
    </div>
  );
}
