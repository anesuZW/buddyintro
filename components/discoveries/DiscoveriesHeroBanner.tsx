"use client";

import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

export function DiscoveriesHeroBanner({ expiryHours }: { expiryHours: number }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: ANALYTICS_EVENTS.DISCOVERY_BANNER_VIEWED }),
    }).catch(() => {});
  }, []);

  return (
    <section className="mx-4 mb-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-fi-card to-fi-card p-4">
      <div className="flex gap-3">
        <div className="rounded-full bg-primary/15 p-2 h-fit shrink-0">
          <Clock size={18} className="text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-bold leading-snug">
            Discoveries disappear after {expiryHours} hours
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Share updates with your trusted network. Mutual introductions can discover you through
            people you already trust.
          </p>
          <p className="text-xs font-medium text-primary/90 rounded-lg bg-primary/10 px-3 py-2">
            Check back often — discoveries expire automatically.
          </p>
        </div>
      </div>
    </section>
  );
}
