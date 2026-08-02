import { StoryBar } from "@/components/stories/StoryBar";
import { FeedList } from "@/components/feed/FeedList";
import { SoftLoadFailure } from "@/components/ui/SoftLoadFailure";
import { loadHomeDashboardFeed } from "@/services/home-dashboard";

export async function HomeFeedPanels({ userId }: { userId: string }) {
  try {
    const { groups, feed } = await loadHomeDashboardFeed(userId);

    return (
      <div data-home-feed="hydrated" data-initial-ssr="true">
        <StoryBar groups={groups} currentUserId={userId} />
        <FeedList items={feed} currentUserId={userId} />
      </div>
    );
  } catch (err) {
    console.error("[home] feed load failed", err);
    return (
      <SoftLoadFailure
        title="Home feed unavailable"
        description="We could not load stories and posts right now. Pull to refresh or try again shortly."
        retryHref="/home"
      />
    );
  }
}
