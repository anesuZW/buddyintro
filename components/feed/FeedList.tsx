"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import type { FeedItem } from "@/types";

import { COPY } from "@/lib/copy";

export function FeedList({
  items,
  currentUserId,
}: {
  items: FeedItem[];
  currentUserId: string;
}) {
  if (!items.length) {
    return (
      <div className="px-4 mt-6">
        <div className="card p-6 text-center">
          <h3 className="font-semibold">Welcome to {COPY.appName}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Introduce people you trust and they&apos;ll appear here as your trusted network grows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 mt-2">
      {items.map((item, i) =>
        item.kind === "story" ? (
          <StoryFeedCard key={item.story.id + i} item={item.story} currentUserId={currentUserId} />
        ) : (
          <PostFeedCard key={item.post.id + i} item={item.post} />
        )
      )}
    </div>
  );
}

function StoryFeedCard({
  item,
  currentUserId,
}: {
  item: Extract<FeedItem, { kind: "story" }>["story"];
  currentUserId: string;
}) {
  return (
    <Link
      href={`/stories/${item.user.id}`}
      className="card overflow-hidden block group"
    >
      <div className="p-4 flex items-center gap-3">
        <Avatar src={item.user.profilePicture} name={item.user.name} size="sm" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{item.user.name}</div>
          <div className="text-xs text-muted-foreground">
            shared an introduction · {timeAgo(item.createdAt)}
          </div>
        </div>
      </div>
      <div className="aspect-video bg-black relative">
        {item.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.mediaUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <video src={item.mediaUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
        )}
      </div>
      {(item.text || item.tags.length > 0) && (
        <div className="p-4 space-y-2">
          {item.text && <p className="text-sm">{item.text}</p>}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => {
                const u = t.taggedUser;
                if (!u) {
                  return (
                    <span
                      key={t.id}
                      className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                    >
                      @{t.taggedExternalEmail}
                    </span>
                  );
                }
                return (
                  <span
                    key={t.id}
                    className="text-xs px-2 py-1 rounded-full bg-muted"
                  >
                    {u.id === currentUserId ? "you" : u.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function PostFeedCard({
  item,
}: {
  item: Extract<FeedItem, { kind: "post" }>["post"];
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar src={item.user.profilePicture} name={item.user.name} size="sm" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{item.user.name}</div>
          <div className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</div>
        </div>
      </div>
      {item.content && <p className="mt-3 text-sm">{item.content}</p>}
      {item.media && (
        <div className="mt-3 rounded-2xl overflow-hidden aspect-video bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.media} alt="" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
