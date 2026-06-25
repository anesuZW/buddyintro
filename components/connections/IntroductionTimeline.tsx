"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { IntroductionEvidencePayload } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { IntroductionStoryLink } from "./ConnectionReasonLink";

export function IntroductionTimeline({
  items,
}: {
  items: IntroductionEvidencePayload[];
}) {
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No introduction stories found for this connection.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold px-1">Introduction timeline</h2>
      {items.map((item) => (
        <Link
          key={item.storyId}
          href={item.storyHref}
          className="card flex gap-3 p-3 hover:bg-muted/50 transition group"
        >
          <div className="h-16 w-12 rounded-lg overflow-hidden bg-black shrink-0">
            {item.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Avatar
                src={item.introducer.profilePicture}
                name={item.introducer.name}
                size="xs"
              />
              <span className="text-sm font-medium truncate">
                {item.introducer.name} introduced{" "}
                {item.introducedUsers.map((u) => u.name).join(" & ") ||
                  "someone"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {item.caption}
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(item.date), "MMMM yyyy")}
              </span>
              <IntroductionStoryLink
                storyId={item.storyId}
                label="View introduction"
                className="opacity-80 group-hover:opacity-100"
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
