import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getStoryBarForViewer } from "@/services/stories";
import { StoryRingAvatar } from "@/components/ui/Avatar";
import { COPY } from "@/lib/copy";

export default async function StoriesPage() {
  const user = await requireUser();
  const groups = await getStoryBarForViewer(user.id);

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold">{COPY.introductions}</h1>
      {groups.length === 0 ? (
        <div className="card p-8 mt-6 text-center">
          <p className="text-muted-foreground">
            No introductions yet. Introduce someone you trust so your network can discover them.
          </p>
          <Link href="/create-story" className="btn-primary mt-4">
            {COPY.createIntroduction}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {groups.map((g) => (
            <Link
              key={g.user.id}
              href={`/stories/${g.user.id}`}
              className="card overflow-hidden aspect-[3/4] relative group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.stories[0].mediaUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition"
              />
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center gap-2">
                  <StoryRingAvatar
                    src={g.user.profilePicture}
                    name={g.user.name}
                    size="xs"
                    active={g.hasUnseen}
                  />
                  <span className="text-white text-xs font-medium truncate">
                    {g.user.id === user.id ? "You" : g.user.name}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
