import "server-only";

import { prisma } from "@/lib/prisma";
import type { StoryWithRelations } from "@/types";
import { signStoredMediaUrl } from "@/lib/storage-signed";
import { appUrl } from "@/lib/utils";
// appUrl is the single source for absolute invite URLs (env-derived).

const storyInclude = {
  user: { select: { id: true, name: true, profilePicture: true } },
  category: { select: { id: true, name: true } },
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
      relationshipLabel: string | null;
    };

export async function getInvitePreviewByToken(
  token: string
): Promise<InvitePreviewResult> {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteToken: token },
    include: {
      invitedBy: { select: { id: true, name: true, profilePicture: true } },
      storyTags: {
        orderBy: { createdAt: "desc" },
        include: {
          story: { include: storyInclude },
        },
      },
    },
  });

  if (!invitation) return { status: "not_found" };
  if (invitation.registered) return { status: "registered" };
  if (invitation.expiresAt < new Date()) return { status: "expired" };

  const storyTag = invitation.storyTags.find(
    (tag) => tag.story && tag.story.status === "draft"
  );
  const story = storyTag?.story;
  if (!story) return { status: "not_found" };
  if (story.expiresAt < new Date()) return { status: "expired" };

  const [mediaUrl, voiceNoteUrl] = await Promise.all([
    signStoredMediaUrl(story.mediaUrl),
    signStoredMediaUrl(story.voiceNoteUrl),
  ]);

  const relationshipLabel =
    (story as { category?: { name?: string } | null }).category?.name ?? null;

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
    relationshipLabel,
  };
}

export function invitePreviewUrl(token: string) {
  return appUrl(`/invite-preview/${token}`);
}

export function inviteSignupUrl(token: string) {
  return appUrl(`/signup?invite=${token}`);
}

export function inviteOgImageUrl(token: string) {
  return appUrl(`/api/public/invites/${token}/og`);
}

export function buildInviteOpenGraph(args: {
  token: string;
  inviterName: string;
  relationshipLabel?: string | null;
  storyText?: string | null;
}) {
  const relationship = args.relationshipLabel?.trim();
  const titledRelationship = relationship
    ? /^(a|an|the)\s/i.test(relationship)
      ? relationship
      : /^[aeiou]/i.test(relationship)
        ? `an ${relationship}`
        : `a ${relationship}`
    : null;
  const title = titledRelationship
    ? `${args.inviterName} introduced you as ${titledRelationship}`
    : `${args.inviterName} shared a story with you`;
  const description =
    args.storyText?.trim() ||
    `See what ${args.inviterName} shared about you on BuddyIntro.`;
  const url = invitePreviewUrl(args.token);
  const image = inviteOgImageUrl(args.token);

  return {
    title,
    description,
    url,
    openGraph: {
      title,
      description,
      url,
      type: "website" as const,
      siteName: "BuddyIntro",
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [image],
    },
  };
}
