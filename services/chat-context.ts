import "server-only";

import { getAdminSettings } from "@/services/admin";
import { getConversationGraphContext } from "@/lib/introduction-graph";
import { serializeConnectionReason } from "@/lib/connection-reason";
import { getTrustProfile } from "@/services/trust-profile";
import { introductionDetailHref } from "@/lib/introduction-routes";
import {
  getConversationContext,
  getOriginatingStoryForConversation,
} from "@/services/messages";
import { canAccessChatContextWhenNoThread } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { isUserBlocked } from "@/services/moderation";
import type { ChatContextPayload } from "@/types";

function storyCaption(story: {
  user: { name: string };
  tags: Array<{ taggedUser: { name: string } | null }>;
  text: string | null;
}) {
  const tagged = story.tags
    .map((t) => t.taggedUser?.name)
    .filter(Boolean)
    .slice(0, 2);
  if (tagged.length) {
    return `${story.user.name} introducing ${tagged.join(" & ")}`;
  }
  return story.text ?? `${story.user.name}'s introduction`;
}

export async function getChatContextPayload(
  viewerId: string,
  otherUserId: string
): Promise<ChatContextPayload | null> {
  if (viewerId !== otherUserId && (await isUserBlocked(viewerId, otherUserId))) {
    return null;
  }

  const [settings, context] = await Promise.all([
    getAdminSettings(),
    getConversationContext(viewerId, otherUserId),
  ]);

  if (!context) {
    const existing = await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: viewerId },
        ],
      },
      select: { id: true },
    });
    if (!existing) {
      const allowed = await canAccessChatContextWhenNoThread(viewerId, otherUserId);
      if (!allowed) return null;
    }
  }

  const story = await getOriginatingStoryForConversation(
    viewerId,
    otherUserId,
    context ?? undefined
  );

  const origin = context?.origin ?? (story ? "story" : "direct");

  let graph: ChatContextPayload["graph"] = null;
  if (settings.enableIntroductionGraph) {
    const g = await getConversationGraphContext(viewerId, otherUserId);
    const trustProfile = settings.showSharedIntroducers
      ? await getTrustProfile(viewerId, otherUserId, settings, {
          sharedIntroducerCount: g.mutualCount,
          sharedIntroducers: g.mutualIntroducers.slice(0, 10).map((m) => ({
            id: m.id,
            name: m.name,
            profilePicture: m.profilePicture,
            storyHref: introductionDetailHref(m.viewerStoryId),
            category: null,
          })),
        })
      : undefined;
    graph = {
      mutualIntroducers: g.mutualIntroducers.map((m) => ({
        id: m.id,
        name: m.name,
        profilePicture: m.profilePicture,
        introducedViewerAt: m.introducedViewerAt.toISOString(),
        introducedOtherAt: m.introducedOtherAt.toISOString(),
        viewerStoryId: m.viewerStoryId,
        otherStoryId: m.otherStoryId,
      })),
      mutualCount: g.mutualCount,
      firstConnectionAt: g.firstConnectionAt?.toISOString() ?? null,
      paths: g.paths.map((p) => ({
        introducer: p.introducer,
        toViewer: { storyId: p.toViewer.storyId, at: p.toViewer.at.toISOString() },
        toOther: { storyId: p.toOther.storyId, at: p.toOther.at.toISOString() },
      })),
      pathChain: g.pathChain.map((n) => ({
        id: n.id,
        name: n.name,
        profilePicture: n.profilePicture,
        storyId: n.storyId,
      })),
      connectionReason: serializeConnectionReason(
        g.connectionReason,
        viewerId,
        otherUserId
      ),
      trustProfile,
      relatedByIntroducer: g.relatedByIntroducer.map((r) => ({
        introducer: r.introducer,
        people: r.people.map((p) => ({
          id: p.id,
          name: p.name,
          profilePicture: p.profilePicture,
          storyId: p.storyId,
          introducedAt: p.introducedAt.toISOString(),
        })),
      })),
    };
  }

  return {
    origin,
    showConnectionPaths: settings.showConnectionPaths,
    showConnectionReasons: settings.showConnectionReasons,
    story: story
      ? {
          id: story.id,
          mediaUrl: story.mediaUrl,
          mediaType: story.mediaType,
          text: story.text,
          caption: storyCaption(story),
          author: story.user,
        }
      : null,
    discoveriesPost: context?.discoveriesPost
      ? {
          id: context.discoveriesPost.id,
          content: context.discoveriesPost.content,
          mediaUrl: context.discoveriesPost.mediaUrl,
          author: context.discoveriesPost.user,
        }
      : null,
    graph,
  };
}
