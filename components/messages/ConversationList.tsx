"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import { COPY } from "@/lib/copy";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import type { ConversationSummary } from "@/types";

export function ConversationList({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  if (!conversations.length) {
    return (
      <div className="card p-6 text-center">
        <p className="text-muted-foreground">
          No conversations yet. Message someone from an introduction to start chatting.
        </p>
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {conversations.map((c) => {
        const trust = c.trustProfile;
        const topIntroducers = trust?.sharedIntroducers.slice(0, 3).map((s) => s.name) ?? [];
        return (
          <li key={c.otherUser.id}>
            <Link
              href={`/messages/${c.otherUser.id}`}
              className="flex items-center gap-3 p-3 hover:bg-muted transition"
            >
              <Avatar
                src={c.otherUser.profilePicture}
                name={c.otherUser.name}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">
                    {c.otherUser.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(c.lastMessage.createdAt)}
                  </span>
                </div>
                {trust && trust.sharedIntroducerCount > 0 && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <TrustScoreBadge trustProfile={trust} showScore={false} />
                    {topIntroducers.length > 0 && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {COPY.introducedThrough}: {topIntroducers.join(", ")}
                        {trust.sharedIntroducerCount > 3
                          ? ` +${trust.sharedIntroducerCount - 3}`
                          : ""}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">
                    {c.lastMessage.message}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
