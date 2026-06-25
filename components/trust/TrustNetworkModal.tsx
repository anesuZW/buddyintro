"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { COPY } from "@/lib/copy";
import { Avatar } from "@/components/ui/Avatar";
import type { TrustProfilePayload } from "@/types";

export function TrustNetworkModal({
  trustProfile,
  otherName,
  onClose,
}: {
  trustProfile: TrustProfilePayload;
  otherName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{COPY.trustNetworkModal}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Who introduced both you and {otherName}?
          </p>
          <div className="text-center py-2">
            <p className="text-2xl font-bold">{trustProfile.sharedIntroducerCount}</p>
            <p className="text-sm text-muted-foreground">
              {COPY.sharedIntroducerCount(trustProfile.sharedIntroducerCount)}
            </p>
            <p className="text-sm font-medium text-primary mt-1">
              {trustProfile.trustLevelLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {COPY.trustScore} {trustProfile.trustScore}
            </p>
          </div>
          <ul className="space-y-3">
            {trustProfile.sharedIntroducers.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50"
              >
                <Avatar src={s.profilePicture} name={s.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  {s.category && (
                    <p className="text-xs text-muted-foreground">{s.category.name}</p>
                  )}
                </div>
                <Link
                  href={s.storyHref}
                  className="text-xs text-primary font-medium hover:underline shrink-0"
                >
                  View intro
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
