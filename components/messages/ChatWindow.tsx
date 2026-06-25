"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { TrustedUserBadge } from "@/components/trust/TrustedUserBadge";
import { TrustRankBadge } from "@/components/trust/TrustRankBadge";
import type { VerificationLevel } from "@prisma/client";
import { MessageComposer } from "./MessageComposer";
import { ChatContextHeader } from "./ChatContextHeader";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { cn, timeAgo } from "@/lib/utils";
import { introductionDetailHref } from "@/lib/introduction-routes";

type Profile = {
  id: string;
  name: string;
  profilePicture: string | null;
  trustedUser?: boolean;
  verificationLevel?: VerificationLevel | null;
  trustRankTier?: string | null;
};
type DbMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  story_reference: string | null;
  created_at: string;
  read_at: string | null;
};

export function ChatWindow({
  currentUser,
  otherUser,
  initialMessages,
  storyContext,
  discoveriesPostId,
  conversationOrigin,
}: {
  currentUser: Profile;
  otherUser: Profile;
  initialMessages: any[];
  storyContext?: { id: string; mediaUrl: string; mediaType: string } | null;
  discoveriesPostId?: string | null;
  conversationOrigin?: "story" | "discoveries" | "direct";
}) {
  const bootstrap = useMemo<DbMessage[]>(
    () =>
      initialMessages.map((m) => ({
        id: m.id,
        sender_id: m.senderId,
        receiver_id: m.receiverId,
        message: m.message,
        story_reference: m.storyReference,
        created_at: new Date(m.createdAt).toISOString(),
        read_at: m.readAt ? new Date(m.readAt).toISOString() : null,
      })),
    [initialMessages]
  );

  const { messages, setMessages } = useRealtimeMessages(
    currentUser.id,
    otherUser.id,
    bootstrap
  );

  const all = mergeMessages(bootstrap, messages);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [all.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Link
          href="/messages"
          className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </Link>
        <Avatar src={otherUser.profilePicture} name={otherUser.name} size="md" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{otherUser.name}</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            <TrustedUserBadge
              trustedUser={otherUser.trustedUser}
              verificationLevel={otherUser.verificationLevel ?? undefined}
              compact
            />
            <TrustRankBadge tier={otherUser.trustRankTier} compact />
          </div>
        </div>
      </div>

      <ChatContextHeader
        otherUserId={otherUser.id}
        viewerName={currentUser.name}
        otherName={otherUser.name}
      />

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {all.map((m) => {
          const mine = m.sender_id === currentUser.id;
          return (
            <div
              key={m.id}
              className={cn("flex flex-col", mine ? "items-end" : "items-start")}
            >
              {m.story_reference && (
                <Link
                  href={introductionDetailHref(m.story_reference)}
                  className="mb-1 text-[11px] text-muted-foreground hover:underline"
                >
                  ↪ Replying to an introduction
                </Link>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                {m.message}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {timeAgo(new Date(m.created_at))}
              </div>
            </div>
          );
        })}
        {all.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">
            Say hi to start the conversation
          </div>
        )}
      </div>

      <MessageComposer
        currentUserId={currentUser.id}
        otherUserId={otherUser.id}
        storyReference={storyContext?.id ?? null}
        storyContext={storyContext}
        discoveriesPostReference={discoveriesPostId ?? null}
        conversationOrigin={
          conversationOrigin ??
          (storyContext ? "story" : discoveriesPostId ? "discoveries" : "direct")
        }
        onSent={(m) =>
          setMessages((prev) =>
            prev.find((x) => x.id === m.id) ? prev : [...prev, m as any]
          )
        }
      />
    </div>
  );
}

function mergeMessages(a: DbMessage[], b: DbMessage[]) {
  const map = new Map<string, DbMessage>();
  for (const m of a) map.set(m.id, m);
  for (const m of b) map.set(m.id, m);
  return Array.from(map.values()).sort(
    (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
  );
}
