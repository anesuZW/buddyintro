"use client";

import { TranslateAction } from "@/components/i18n/TranslateAction";
import { Link } from "@/lib/i18n/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ChatContextPayload } from "@/types";

import { COPY } from "@/lib/copy";
import { introductionDetailHref } from "@/lib/introduction-routes";

export function StoryReferenceCard({
  story,
}: {
  story: NonNullable<ChatContextPayload["story"]>;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-fi-card p-3 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Replying to introduction
      </div>
      <div className="flex gap-3">
        <div className="h-14 w-10 rounded-lg overflow-hidden bg-black shrink-0">
          {story.mediaType === "video" ? (
            <video src={story.mediaUrl} className="h-full w-full object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.mediaUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2">&ldquo;{story.caption}&rdquo;</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">by {story.author.name}</p>
            <TranslateAction contentType="introduction" />
          </div>
        </div>
      </div>
      <Link href={introductionDetailHref(story.id)}>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <ExternalLink size={14} />
          View introduction
        </Button>
      </Link>
    </div>
  );
}
