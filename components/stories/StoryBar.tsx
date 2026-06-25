"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { StoryRingAvatar } from "@/components/ui/Avatar";
import { COPY } from "@/lib/copy";
import type { StoryWithRelations } from "@/types";

export type StoryGroup = {
  user: { id: string; name: string; profilePicture: string | null };
  stories: StoryWithRelations[];
  hasUnseen: boolean;
};

export function StoryBar({
  groups,
  currentUserId,
}: {
  groups: StoryGroup[];
  currentUserId: string;
}) {
  return (
    <div className="px-4 py-3 overflow-x-auto no-scrollbar">
      <div className="flex gap-4 min-w-max">
        <Link
          href="/create-story"
          className="flex flex-col items-center gap-1.5 w-16"
          aria-label={COPY.createIntroduction}
        >
          <div className="relative h-16 w-16 rounded-full bg-muted border border-dashed border-border flex items-center justify-center">
            <Plus size={22} className="text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-full">
            {COPY.yourIntroductions}
          </span>
        </Link>

        {groups.map((group) => (
          <Link
            key={group.user.id}
            href={`/stories/${group.user.id}`}
            className="flex flex-col items-center gap-1.5 w-16"
          >
            <StoryRingAvatar
              src={group.user.profilePicture}
              name={group.user.name}
              size="lg"
              active={group.hasUnseen}
            />
            <span className="text-xs truncate max-w-full">
              {group.user.id === currentUserId ? "You" : group.user.name.split(" ")[0]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
