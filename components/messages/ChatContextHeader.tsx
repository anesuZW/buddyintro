"use client";

import { useEffect, useState } from "react";
import type { ChatContextPayload } from "@/types";
import { StoryReferenceCard } from "./StoryReferenceCard";
import { ConnectionContextPanel } from "./ConnectionContextPanel";
import { ConnectionPathViewer } from "@/components/connections/ConnectionPathViewer";
import {
  IntroductionPathGraph,
  RelatedIntroductionsList,
} from "./IntroductionPathGraph";

export function ChatContextHeader({
  otherUserId,
  viewerName,
  otherName,
}: {
  otherUserId: string;
  viewerName: string;
  otherName: string;
}) {
  const [context, setContext] = useState<ChatContextPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/messages/${otherUserId}/context`);
        if (res.ok) setContext(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [otherUserId]);

  if (loading) {
    return (
      <div className="px-4 py-3 border-b border-border bg-muted/30 animate-pulse h-16" />
    );
  }

  if (!context) return null;

  const showStory = Boolean(context.story);
  const showDiscoveries = context.origin === "discoveries";
  const graph = context.graph;

  if (!showStory && !showDiscoveries && !graph) return null;

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur shrink-0 max-h-[45vh] overflow-y-auto">
      <div className="px-4 py-3 space-y-3">
        {showStory && context.story && <StoryReferenceCard story={context.story} />}

        {showDiscoveries && context.discoveriesPost && (
          <div className="rounded-xl border border-accent-gold/30 bg-fi-card p-3 text-sm">
            <div className="text-xs font-semibold text-accent-gold uppercase tracking-wide mb-1">
              Started from Discoveries
            </div>
            <p className="line-clamp-2 text-muted-foreground">
              {context.discoveriesPost.content ?? "Discoveries post"}
            </p>
          </div>
        )}

        {graph && (
          <>
            <ConnectionContextPanel graph={graph} origin={context.origin} />
            {context.showConnectionPaths !== false && (
              <>
                {graph.pathChain.length >= 2 && (
                  <ConnectionPathViewer
                    pathChain={graph.pathChain}
                    viewerLabel={viewerName === "You" ? "You" : viewerName}
                  />
                )}
                <IntroductionPathGraph
                  paths={graph.paths}
                  viewerName={viewerName}
                  otherName={otherName}
                />
                <RelatedIntroductionsList sections={graph.relatedByIntroducer} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
