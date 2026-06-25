"use client";

import { COPY } from "@/lib/copy";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import { ConnectionReasonLink, IntroductionStoryLink } from "@/components/connections/ConnectionReasonLink";
import { SharedIntroducersPanel } from "@/components/trust/SharedIntroducersPanel";
import { VerificationBadges } from "@/components/trust/VerificationBadges";
import type { ChatContextPayload } from "@/types";

export function ConnectionContextPanel({
  graph,
  origin,
}: {
  graph: NonNullable<ChatContextPayload["graph"]>;
  origin: ChatContextPayload["origin"];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      {origin === "discoveries" && (
        <div className="text-xs font-semibold text-accent-gold uppercase tracking-wide">
          Started from Discoveries
        </div>
      )}

      {graph.trustProfile && (
        <SharedIntroducersPanel trustProfile={graph.trustProfile} />
      )}

      {graph.trustProfile && (
        <VerificationBadges verification={graph.trustProfile.verification} />
      )}

      <div>
        <h3 className="text-sm font-semibold">{COPY.howYouAreConnected}</h3>
        <div className="mt-2">
          <ConnectionReasonLink connectionReason={graph.connectionReason} compact />
        </div>
      </div>

      {graph.mutualIntroducers.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">You were introduced by:</p>
          <ul className="space-y-3">
            {graph.mutualIntroducers.map((m) => (
              <li key={m.id} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Check size={14} className="text-accent shrink-0" />
                  <Avatar src={m.profilePicture} name={m.name} size="xs" />
                  <span className="font-medium">{m.name}</span>
                </div>
                <IntroductionStoryLink
                  storyId={m.viewerStoryId}
                  label="View introduction"
                  className="ml-6"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
        <span>
          Mutual introductions:{" "}
          <strong className="text-foreground">{graph.mutualCount}</strong>
        </span>
        {graph.firstConnectionAt && (
          <span>
            First connected:{" "}
            <strong className="text-foreground">
              {timeAgo(new Date(graph.firstConnectionAt))}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
