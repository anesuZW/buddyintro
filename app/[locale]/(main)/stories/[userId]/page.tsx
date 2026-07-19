import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getVisibleStories } from "@/services/stories";
import { StoryViewer } from "@/components/stories/StoryViewer";

export default async function StoriesByUserPage({
  params,
}: {
  params: { userId: string };
}) {
  const me = await requireUser();
  const all = await getVisibleStories(me.id);
  const stories = all
    .filter((s) => s.userId === params.userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (stories.length === 0) notFound();

  return <StoryViewer stories={stories} currentUserId={me.id} />;
}
