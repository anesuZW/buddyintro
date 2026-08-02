import { requireUser } from "@/lib/auth";
import { getAdminSettings } from "@/services/admin";
import { getDiscoveriesFeed } from "@/services/discoveries";
import { getTrustRecommendations } from "@/services/trust-recommendations";
import { DiscoveriesComposer } from "@/components/discoveries/DiscoveriesComposer";
import { DiscoveriesFeed } from "@/components/discoveries/DiscoveriesFeed";
import { TrustRecommendationsPanel } from "@/components/trust/TrustRecommendationsPanel";
import { SoftLoadFailure } from "@/components/ui/SoftLoadFailure";
import { resolveDiscoveriesUx } from "@/lib/discoveries-ux-settings";
import { runWithPerf } from "@/lib/perf/context";
import { getDiscoveriesViewerConnections } from "@/lib/discoveries-graph-context";

export default async function DiscoveriesPage() {
  return runWithPerf({ kind: "page", label: "/discoveries" }, async () => {
    const user = await requireUser();
    let settings;
    try {
      settings = await getAdminSettings();
    } catch (err) {
      console.error("[discoveries] settings load failed", err);
      return (
        <SoftLoadFailure
          title="Discoveries unavailable"
          description="We could not reach the server to load Discoveries. Please try again shortly."
          retryHref="/discoveries"
        />
      );
    }
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

    try {
      const connectionRows = await getDiscoveriesViewerConnections(user.id);
      const [recommendations, initialFeed] = await Promise.all([
        getTrustRecommendations(user.id, { connectionRows }),
        getDiscoveriesFeed({
          viewerId: user.id,
          settingsOverride: settings,
          connectionRows,
        }),
      ]);

      return (
        <div>
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-2xl font-bold">Discoveries</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ephemeral updates from your trusted introduction network — visible through mutual
              trust, not public feeds.
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
    } catch (err) {
      console.error("[discoveries] feed load failed", err);
      return (
        <div>
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-2xl font-bold">Discoveries</h1>
          </div>
          <SoftLoadFailure
            title="Could not load Discoveries"
            description="A temporary connection problem interrupted loading. Try again in a moment."
            retryHref="/discoveries"
          />
        </div>
      );
    }
  });
}
