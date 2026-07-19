import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getStoryForViewer } from "@/services/stories";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

export default async function StoryViewPage({
  params,
}: {
  params: { storyId: string };
}) {
  const me = await requireUser();
  const story = await getStoryForViewer(params.storyId, me.id);
  if (!story) notFound();

  void analyticsService.track({
    userId: me.id,
    eventType: ANALYTICS_EVENTS.INTRODUCTION_OPENED,
    entityType: "story",
    entityId: params.storyId,
  });

  const isTagged = story.tags.some((t) => t.taggedUserId === me.id);
  if (isTagged && story.userId !== me.id) {
    void analyticsService.track({
      userId: me.id,
      eventType: ANALYTICS_EVENTS.INTRODUCTION_ACCEPTED,
      entityType: "story",
      entityId: params.storyId,
    });
  }

  return (
    <StoryViewer
      stories={[story]}
      currentUserId={me.id}
      closeHref="/home"
    />
  );
}
