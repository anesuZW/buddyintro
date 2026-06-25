import { StoryBar } from "@/components/stories/StoryBar";
import { FeedList } from "@/components/feed/FeedList";
import { loadHomeDashboardFeed } from "@/services/home-dashboard";

export async function HomeFeedPanels({ userId }: { userId: string }) {
  const { groups, feed } = await loadHomeDashboardFeed(userId);

  return (
    <div data-home-feed="hydrated" data-initial-ssr="true">
      <StoryBar groups={groups} currentUserId={userId} />
      <FeedList items={feed} currentUserId={userId} />
    </div>
  );
}
