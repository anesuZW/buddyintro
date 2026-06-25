import { TrustRecommendationsPanel } from "@/components/trust/TrustRecommendationsPanel";
import { IntroductionSuggestions } from "@/components/trust/IntroductionSuggestions";
import { loadHomeDashboardSecondary } from "@/services/home-dashboard";

export async function HomeSecondaryPanels({ userId }: { userId: string }) {
  const { suggestions, recommendations } = await loadHomeDashboardSecondary(userId);

  return (
    <div
      className="px-4 pb-4 space-y-4"
      data-home-secondary="hydrated"
      data-initial-ssr="true"
    >
      <TrustRecommendationsPanel initialRecommendations={recommendations} />
      <IntroductionSuggestions suggestions={suggestions} />
    </div>
  );
}
