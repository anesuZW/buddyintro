import type { StoryWithRelations } from "@/types";

/** Shared types for home story projection (testable without server-only). */
export type HomeVisibleStoryRow = {
  id: string;
  userId: string;
  visibilityMode: string;
  user: StoryWithRelations["user"];
  tags: StoryWithRelations["tags"];
  status: string;
  expiresAt: Date;
  createdAt: Date;
  mediaUrl: string;
  mediaType: string;
  text: string | null;
};
