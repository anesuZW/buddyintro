import "server-only";

import { prisma } from "@/lib/prisma";
import { getDiscoveriesNetworkAuthorIds } from "@/lib/discoveries-network";
import { filterByCategoryVisibility } from "@/lib/category-visibility";
import { getAdminSettings } from "@/services/admin";
import { filterDiscoveryAuthorIds } from "@/lib/verification-gates";
import { isUserBlocked, listBlockedUserIds } from "@/services/moderation";
import { getStoryForViewer } from "@/services/stories";

export function viewerMayQueryNetworkPair(
  viewerId: string,
  userAId: string,
  userBId: string
): boolean {
  return viewerId === userAId || viewerId === userBId;
}

export async function canViewDiscoveryPost(
  viewerId: string,
  postId: string
): Promise<boolean> {
  const settings = await getAdminSettings();
  if (!settings.discoveriesEnabled) return false;

  const post = await prisma.discoveriesPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      userId: true,
      visibility: true,
      expiresAt: true,
      introductionCategoryId: true,
      visibilityMode: true,
    },
  });
  if (!post) return false;

  if (post.expiresAt && post.expiresAt <= new Date()) return false;
  if (post.userId === viewerId) return true;

  if (await isUserBlocked(viewerId, post.userId)) return false;

  const [networkIds, viewer, blockedIds] = await Promise.all([
    getDiscoveriesNetworkAuthorIds(viewerId),
    prisma.user.findUnique({
      where: { id: viewerId },
      select: {
        id: true,
        phoneVerified: true,
        emailVerified: true,
        identityVerified: true,
        trustedUser: true,
        verificationLevel: true,
        suspendedAt: true,
      },
    }),
    listBlockedUserIds(viewerId),
  ]);
  if (!viewer) return false;

  const blocked = new Set(blockedIds);
  let allowedAuthors = networkIds.filter((id) => !blocked.has(id));
  allowedAuthors = await filterDiscoveryAuthorIds(viewerId, allowedAuthors, viewer);

  const inNetwork = allowedAuthors.includes(post.userId);
  const publicOk = post.visibility === "public" && settings.discoveriesPublicEnabled;

  if (post.visibility === "network" && !inNetwork) return false;
  if (post.visibility === "public" && !publicOk && !inNetwork) return false;

  const [filtered] = await filterByCategoryVisibility(viewerId, [post]);
  return filtered?.id === post.id;
}

export async function canViewTrustProfile(
  viewerId: string,
  otherUserId: string
): Promise<boolean> {
  if (viewerId === otherUserId) return true;
  if (await isUserBlocked(viewerId, otherUserId)) return false;
  return true;
}

export async function canAccessChatContext(
  viewerId: string,
  otherUserId: string
): Promise<boolean> {
  if (viewerId === otherUserId) return true;
  if (await isUserBlocked(viewerId, otherUserId)) return false;

  const existing = await prisma.message.findFirst({
    where: {
      OR: [
        { senderId: viewerId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: viewerId },
      ],
    },
    select: { id: true },
  });
  if (existing) return true;

  return canAccessChatContextWhenNoThread(viewerId, otherUserId);
}

/** Gate check when there is no existing message thread (no conversation context). */
export async function canAccessChatContextWhenNoThread(
  viewerId: string,
  otherUserId: string
): Promise<boolean> {
  const { checkMessagingAllowed } = await import("@/lib/verification-gates");
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  if (!viewer) return false;
  const gate = await checkMessagingAllowed(viewerId, otherUserId, viewer);
  return gate.ok;
}

export async function canAccessStoragePath(
  viewerId: string,
  path: string
): Promise<boolean> {
  const normalized = path.replace(/^\/+/, "");
  const segments = normalized.split("/");
  const ownerId = segments[0];
  if (!ownerId) return false;
  if (viewerId === ownerId) return true;

  // Profile avatars and public-ish image uploads — any authenticated user may view.
  // Without this, /api/media returns 403 for other users' profilePicture paths.
  const kind = segments[1];
  if (kind === "image") return true;

  // Direct path lookup — faster than mediaUrl CONTAINS scan.
  const story = await prisma.story.findFirst({
    where: {
      OR: [
        { mediaUrl: { endsWith: normalized } },
        { mediaUrl: { contains: normalized } },
        { mediaUrl: { contains: `/uploads/${normalized}` } },
        { voiceNoteUrl: { endsWith: normalized } },
        { voiceNoteUrl: { contains: normalized } },
        { voiceNoteUrl: { contains: `/uploads/${normalized}` } },
      ],
    },
    select: { id: true },
  });
  if (story) {
    return (await getStoryForViewer(story.id, viewerId)) !== null;
  }

  const post = await prisma.discoveriesPost.findFirst({
    where: {
      OR: [
        { mediaUrl: { endsWith: normalized } },
        { mediaUrl: { contains: normalized } },
        { mediaUrl: { contains: `/uploads/${normalized}` } },
      ],
    },
    select: { id: true },
  });
  if (post) return canViewDiscoveryPost(viewerId, post.id);

  return false;
}
