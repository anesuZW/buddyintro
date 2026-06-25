import { getAdminSettings } from "@/services/admin";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { DiscoveryControlsAdmin } from "@/components/admin/DiscoveryControlsAdmin";
import { StoryVisibilityAdmin } from "@/components/admin/StoryVisibilityAdmin";
import { DiscoveriesUxAdmin } from "@/components/admin/DiscoveriesUxAdmin";
import { IntroductionCategoriesAdmin } from "@/components/admin/IntroductionCategoriesAdmin";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { AdminAnnouncements } from "@/components/admin/AdminAnnouncements";
import { AdminModerationPanel } from "@/components/admin/AdminModerationPanel";
import { AdminTrustedUsersPanel } from "@/components/admin/AdminTrustedUsersPanel";
import { prisma } from "@/lib/prisma";

export default async function MainDashPage() {
  const [settings, stats] = await Promise.all([
    getAdminSettings(),
    Promise.all([
      prisma.user.count(),
      prisma.story.count(),
      prisma.invitation.count(),
      prisma.invitation.count({ where: { registered: true } }),
      prisma.message.count(),
    ]),
  ]);
  const [users, stories, invites, registered, messages] = stats;

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold">Main Dashboard</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Trust network controls, verification, discovery safety, and analytics.
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Users" value={users} />
        <Stat label="Introductions" value={stories} />
        <Stat label="Invites" value={invites} />
        <Stat label="Registered via invite" value={registered} />
        <Stat label="Messages" value={messages} />
      </div>

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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 bg-fi-card border-primary/10">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
