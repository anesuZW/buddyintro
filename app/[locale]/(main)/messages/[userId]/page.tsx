import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConversation, markRead, ensureConversationContext } from "@/services/messages";
import { getTrustProfile } from "@/services/trust-profile";
import { meetsInviteGate } from "@/services/invites";
import { getAdminSettings } from "@/services/admin";
import { ChatWindow } from "@/components/messages/ChatWindow";
import Link from "next/link";
import { canAccessChatContext } from "@/lib/access-control";
import { getStoryForViewer } from "@/services/stories";
import { isUserBlocked } from "@/services/moderation";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: { story?: string; from?: string; post?: string };
}) {
  const me = await requireUser();
  if (await isUserBlocked(me.id, params.userId)) {
    redirect("/messages");
  }
  if (!(await canAccessChatContext(me.id, params.userId))) {
    redirect("/messages");
  }
  const other = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      name: true,
      profilePicture: true,
      trustedUser: true,
      verificationLevel: true,
    },
  });
  if (!other) notFound();

  const trustProfile = await getTrustProfile(me.id, other.id);

  const settings = await getAdminSettings();
  if (settings.inviteGateEnabled) {
    const ok = await meetsInviteGate(me.id, settings.requiredInvites);
    if (!ok) {
      return (
        <div className="px-4 py-10">
          <div className="card p-6 text-center">
            <h2 className="text-lg font-semibold">Invite gate enabled</h2>
            <p className="text-sm text-muted-foreground mt-2">
              You need to invite at least {settings.requiredInvites} friends who
              register before you can message tagged people.
            </p>
            <Link href="/profile" className="btn-primary mt-4">
              Invite friends
            </Link>
          </div>
        </div>
      );
    }
  }

  let conversationOrigin: "story" | "discoveries" | "direct" = "direct";
  let discoveriesPostId: string | null = null;

  if (searchParams.from === "discoveries" && searchParams.post) {
    conversationOrigin = "discoveries";
    discoveriesPostId = searchParams.post;
    await ensureConversationContext({
      userId: me.id,
      otherUserId: other.id,
      origin: "discoveries",
      discoveriesPostReference: searchParams.post,
    });
  } else if (searchParams.story) {
    conversationOrigin = "story";
    await ensureConversationContext({
      userId: me.id,
      otherUserId: other.id,
      origin: "story",
      storyReference: searchParams.story,
    });
  }

  await markRead(me.id, other.id);
  const conversationPage = await getConversation({
    userId: me.id,
    otherUserId: other.id,
  });
  const initialMessages = conversationPage.items;

  let storyContext: { id: string; mediaUrl: string; mediaType: string } | null = null;
  if (searchParams.story) {
    const s = await getStoryForViewer(searchParams.story, me.id);
    if (s) {
      storyContext = { id: s.id, mediaUrl: s.mediaUrl, mediaType: s.mediaType };
    }
  }

  return (
    <div className="h-[calc(100dvh-9rem)] flex flex-col">
      <ChatWindow
        currentUser={{ id: me.id, name: me.name, profilePicture: me.profilePicture }}
        otherUser={{
          ...other,
          trustRankTier: trustProfile?.trustRankTier,
        }}
        initialMessages={initialMessages}
        storyContext={storyContext}
        discoveriesPostId={discoveriesPostId}
        conversationOrigin={conversationOrigin}
      />
    </div>
  );
}
