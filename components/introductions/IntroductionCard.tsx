"use client";

import Link from "next/link";
import { MessageCircle, Share2, Eye, Mic } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { timeAgo, cn } from "@/lib/utils";
import { BRAND } from "@/lib/branding";
import { introductionDetailHref } from "@/lib/introduction-routes";
import type { IntroductionItem } from "@/types";

export function IntroductionCard({
  item,
  perspective = "received",
}: {
  item: IntroductionItem;
  perspective?: "received" | "sent";
}) {
  const authorId = item.user.id;
  const subtitle =
    perspective === "sent"
      ? "you introduced"
      : "introduced you";

  async function shareIntro() {
    const url = `${window.location.origin}${introductionDetailHref(item.id)}`;
    if (navigator.share) {
      await navigator.share({ title: `${BRAND.name} introduction`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <article
      className={cn(
        "card overflow-hidden",
        item.isUnread && "ring-2 ring-primary/30"
      )}
    >
      <Link href={introductionDetailHref(item.id)} className="block">
      <div className="flex gap-3 p-4">
        <Avatar src={item.user.profilePicture} name={item.user.name} size="md" ring />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{item.user.name}</span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
            {item.isUnread && (
              <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                New
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {timeAgo(item.publishedAt ?? item.createdAt)}
            {item.status === "draft" && " · Pending"}
          </div>
          {item.text && (
            <p className="text-sm mt-2 line-clamp-2">&ldquo;{item.text}&rdquo;</p>
          )}
          {item.voiceNoteUrl && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Mic size={12} /> Voice note attached
            </div>
          )}
        </div>
        <div className="w-16 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
          {item.mediaType === "video" ? (
            <video src={item.mediaUrl} className="w-full h-full object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.mediaUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      </div>
      </Link>

      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {item.tags.slice(0, 4).map((tag) => (
          <span key={tag.id} className="text-xs bg-muted px-2 py-1 rounded-full">
            {tag.taggedUser?.name ?? tag.taggedExternalEmail ?? tag.taggedExternalPhone ?? "invited"}
          </span>
        ))}
      </div>

      <div className="flex gap-2 p-4 pt-2 border-t border-border">
        <Link href={introductionDetailHref(item.id)} className="flex-1">
          <Button variant="outline" className="w-full h-9 text-xs">
            <Eye size={14} /> Open
          </Button>
        </Link>
        <Link
          href={`/messages/${perspective === "sent" ? item.tags.find((t) => t.taggedUserId)?.taggedUserId ?? authorId : authorId}?story=${item.id}`}
          className="flex-1"
        >
          <Button className="w-full h-9 text-xs">
            <MessageCircle size={14} /> Reply
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={shareIntro}>
          <Share2 size={14} />
        </Button>
      </div>
    </article>
  );
}
