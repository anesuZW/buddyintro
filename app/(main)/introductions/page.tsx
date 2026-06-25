import { requireUser } from "@/lib/auth";
import { getTrustRecommendations } from "@/services/trust-recommendations";
import { listIntroductionCategories } from "@/services/introduction-categories";
import { IntroductionsList } from "@/components/introductions/IntroductionsList";
import { IntroductionNetworkPanel } from "@/components/introductions/IntroductionNetworkPanel";
import { TrustRecommendationsPanel } from "@/components/trust/TrustRecommendationsPanel";
import { COPY } from "@/lib/copy";
import { runWithPerf } from "@/lib/perf/context";

export default async function IntroductionsPage() {
  return runWithPerf({ kind: "page", label: "/introductions" }, async () => {
    const user = await requireUser();
    const [recommendations, categories] = await Promise.all([
      getTrustRecommendations(user.id),
      listIntroductionCategories(true),
    ]);

    return (
      <div>
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-bold">{COPY.introductions}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Introductions where you were recommended, tagged, or connected through trusted friends.
          </p>
        </div>
        <IntroductionNetworkPanel userId={user.id} />
        <div className="px-4 pb-2">
          <TrustRecommendationsPanel
            title="Suggested trust connections"
            initialRecommendations={recommendations}
          />
        </div>
        <IntroductionsList initialCategories={categories} />
      </div>
    );
  });
}
