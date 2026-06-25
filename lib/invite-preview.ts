import "server-only";

import { prisma } from "@/lib/prisma";
import type { StoryWithRelations } from "@/types";
import { signStoredMediaUrl } from "@/lib/storage-signed";

const storyInclude = {
  user: { select: { id: true, name: true, profilePicture: true } },
  tags: {
    include: {
      taggedUser: { select: { id: true, name: true, profilePicture: true } },
    },
  },
} as const;

export type InvitePreviewResult =
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "registered" }
  | {
      status: "ok";
      email: string | null;
      phoneNumber: string | null;
      inviteToken: string;
      inviter: { id: string; name: string; profilePicture: string | null };
      story: StoryWithRelations;
    };

export async function getInvitePreviewByToken(
  token: string
): Promise<InvitePreviewResult> {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteToken: token },
    include: {
      invitedBy: { select: { id: true, name: true, profilePicture: true } },
      storyTags: {
        include: {
          story: { include: storyInclude },
        },
      },
    },
  });

  if (!invitation) return { status: "not_found" };
  if (invitation.registered) return { status: "registered" };
  if (invitation.expiresAt < new Date()) return { status: "expired" };

  const storyTag = invitation.storyTags.find((tag) => tag.story);
  const story = storyTag?.story;
  if (!story || story.status !== "draft") return { status: "not_found" };
  if (story.expiresAt < new Date()) return { status: "expired" };

  const [mediaUrl, voiceNoteUrl] = await Promise.all([
    signStoredMediaUrl(story.mediaUrl),
    signStoredMediaUrl(story.voiceNoteUrl),
  ]);

  const signedStory = {
    ...(story as StoryWithRelations),
    mediaUrl: mediaUrl ?? story.mediaUrl,
    voiceNoteUrl: voiceNoteUrl ?? story.voiceNoteUrl,
  };

  return {
    status: "ok",
    email: invitation.email,
    phoneNumber: invitation.phoneNumber,
    inviteToken: invitation.inviteToken,
    inviter: invitation.invitedBy,
    story: signedStory,
  };
}

export function invitePreviewUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite-preview/${token}`;
}

export function inviteSignupUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/signup?invite=${token}`;
}
