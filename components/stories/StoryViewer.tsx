"use client";

import { StoryPlayer } from "./StoryPlayer";
import type { StoryWithRelations } from "@/types";

/**
 * Full-screen story experience for a list of stories
 * (typically all stories from a single author).
 */
export function StoryViewer({
  stories,
  currentUserId,
  onClose,
  closeHref,
}: {
  stories: StoryWithRelations[];
  currentUserId: string;
  onClose?: () => void;
  closeHref?: string;
}) {
  if (!stories?.length) return null;
  return (
    <StoryPlayer
      stories={stories}
      currentUserId={currentUserId}
      onClose={onClose}
      closeHref={closeHref}
    />
  );
}
