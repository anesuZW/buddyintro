import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIntroductionExpiryFilter } from "@/lib/introductions-settings";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/utils";
import { Eye, MessageCircle } from "lucide-react";
import { getStoryForViewer } from "@/services/stories";
import {
  introductionDetailHref,
  introductionStoryViewerHref,
} from "@/lib/introduction-routes";

export default async function IntroductionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const story = await getStoryForViewer(params.id, me.id);

  if (!story) notFound();

  const expiryFilter = await getIntroductionExpiryFilter();
  const related = await prisma.story.findMany({
    where: {
      ...expiryFilter,
      userId: story.userId,
      id: { not: story.id },
      tags: { some: { taggedUserId: me.id } },
      status: { in: ["published", "expired"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      user: { select: { id: true, name: true, profilePicture: true } },
    },
  });

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="card overflow-hidden">
        <div className="flex gap-3 p-4">
          <Avatar src={story.user.profilePicture} name={story.user.name} size="md" ring />
          <div>
            <div className="font-semibold">{story.user.name}</div>
            <div className="text-xs text-muted-foreground">
              introduced you · {timeAgo(story.publishedAt ?? story.createdAt)}
            </div>
          </div>
        </div>

        {story.mediaUrl && (
          <div className="bg-black">
            {story.mediaType === "video" ? (
              <video src={story.mediaUrl} controls playsInline className="w-full max-h-80" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.mediaUrl} alt="" className="w-full max-h-80 object-cover" />
            )}
          </div>
        )}

        {story.text && <p className="p-4 text-sm">{story.text}</p>}

        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {story.tags.map((tag) => (
            <span key={tag.id} className="text-xs bg-muted px-2 py-1 rounded-full">
              {tag.taggedUser?.name ?? tag.taggedExternalEmail ?? tag.taggedExternalPhone}
            </span>
          ))}
        </div>

        <div className="flex gap-2 p-4 border-t border-border">
          <Link href={introductionStoryViewerHref(story.id)} className="flex-1">
            <Button variant="outline" className="w-full">
              <Eye size={16} /> View story
            </Button>
          </Link>
          <Link href={`/messages/${story.user.id}?story=${story.id}`} className="flex-1">
            <Button className="w-full">
              <MessageCircle size={16} /> Reply
            </Button>
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-3">More from {story.user.name}</h2>
          <div className="space-y-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={introductionDetailHref(r.id)}
                className="card p-3 flex items-center gap-3 hover:bg-muted/50 transition"
              >
                <Avatar src={r.user.profilePicture} name={r.user.name} size="sm" />
                <div className="text-sm truncate">{r.text ?? "Introduction story"}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
