import { requireUser } from "@/lib/auth";
import { getAdminSettings } from "@/services/admin";
import { getDiscoveriesFeed } from "@/services/discoveries";
import { getTrustRecommendations } from "@/services/trust-recommendations";
import { DiscoveriesComposer } from "@/components/discoveries/DiscoveriesComposer";
import { DiscoveriesFeed } from "@/components/discoveries/DiscoveriesFeed";
import { TrustRecommendationsPanel } from "@/components/trust/TrustRecommendationsPanel";
import { resolveDiscoveriesUx } from "@/lib/discoveries-ux-settings";
import { runWithPerf } from "@/lib/perf/context";

export default async function DiscoveriesPage() {
  return runWithPerf({ kind: "page", label: "/discoveries" }, async () => {
    const user = await requireUser();
    const settings = await getAdminSettings();
    const ux = resolveDiscoveriesUx(settings);

    if (!settings.discoveriesEnabled) {
      return (
        <div className="px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">Discoveries</h1>
          <p className="mt-2 text-muted-foreground">
            Discoveries is currently disabled by the administrator.
          </p>
        </div>
      );
    }

    const [recommendations, initialFeed] = await Promise.all([
      getTrustRecommendations(user.id),
      getDiscoveriesFeed({ viewerId: user.id, settingsOverride: settings }),
    ]);

    return (
      <div>
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-bold">Discoveries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ephemeral updates from your trusted introduction network — visible through mutual trust,
            not public feeds.
          </p>
        </div>
        <DiscoveriesComposer userId={user.id} expiryHours={ux.expiryHours} />
        <div className="px-4 pb-2">
          <TrustRecommendationsPanel
            title="People you may want to connect with"
            initialRecommendations={recommendations}
          />
        </div>
        <DiscoveriesFeed ux={ux} initialFeed={initialFeed} />
      </div>
    );
  });
}
