"use client";

import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IntroductionStoryLink } from "@/components/connections/ConnectionReasonLink";
import type { ChatContextPayload } from "@/types";

type PathChainNode = NonNullable<ChatContextPayload["graph"]>["pathChain"][number];

export function ConnectionPathViewer({
  pathChain,
  viewerLabel = "You",
}: {
  pathChain: PathChainNode[];
  viewerLabel?: string;
}) {
  if (pathChain.length < 2) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <h3 className="text-sm font-semibold">Connection path</h3>
      <div className="flex flex-col items-center gap-1 py-1">
        {pathChain.map((node, index) => {
          const isViewer = index === 0;
          const displayName = isViewer ? viewerLabel : node.name;

          return (
            <div key={node.id} className="flex flex-col items-center w-full">
              <div className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 hover:bg-muted/60 transition w-full max-w-xs">
                <Link href={`/profile/${node.id}`} className="flex flex-col items-center gap-1">
                  <Avatar
                    src={node.profilePicture}
                    name={node.name}
                    size="sm"
                    className="ring-2 ring-primary/20"
                  />
                  <span className="text-sm font-medium text-primary hover:underline">
                    {displayName}
                  </span>
                </Link>
                {node.storyId && (
                  <IntroductionStoryLink
                    storyId={node.storyId}
                    label="View introduction"
                    className="justify-center"
                  />
                )}
              </div>
              {index < pathChain.length - 1 && (
                <ArrowDown size={16} className="text-muted-foreground my-0.5" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
