"use client";

import { useEffect, useState } from "react";
import type { UserInsightsResult } from "@/services/analytics/types";

export function UserInsightsPanel({
  initialInsights,
}: {
  /** When set (including null), insights were loaded on the server — skip client fetch. */
  initialInsights?: UserInsightsResult | null;
}) {
  const [insights, setInsights] = useState<UserInsightsResult | null>(
    initialInsights === undefined ? null : initialInsights
  );
  const [loading, setLoading] = useState(initialInsights === undefined);

  useEffect(() => {
    if (initialInsights !== undefined) return;
    fetch("/api/profile/insights")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setInsights(data?.insights ?? null))
      .finally(() => setLoading(false));
  }, [initialInsights]);

  if (loading) {
    return (
      <div className="card p-6 mt-6">
        <p className="text-sm text-muted-foreground">Loading your insights…</p>
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div
      className="card p-6 mt-6 space-y-6"
      data-profile-insights="hydrated"
      data-initial-ssr={initialInsights !== undefined}
    >
      <section className="space-y-3">
        <h2 className="font-semibold">My trust network</h2>
        <div className="grid grid-cols-2 gap-3">
          <InsightStat label="People connected" value={insights.peopleConnected} />
          <InsightStat label="Shared introducers" value={insights.sharedIntroducers} />
          <InsightStat label="Trust score" value={insights.trustScore} />
          <InsightStat label="Trust growth (30d)" value={insights.trustGrowth} />
          <InsightStat label="Network growth (30d)" value={insights.networkGrowth} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">My introductions</h2>
        <div className="grid grid-cols-2 gap-3">
          <InsightStat label="Created" value={insights.introductionsCreated} />
          <InsightStat label="Received" value={insights.introductionsReceived} />
          <InsightStat label="Viewed (30d)" value={insights.introductionViews} />
          <InsightStat label="Accepted" value={insights.introductionsAccepted} />
          <InsightStat label="People introduced" value={insights.peopleIntroduced} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">My discovery reach</h2>
        <div className="grid grid-cols-2 gap-3">
          <InsightStat label="Trusted people who viewed" value={insights.discoveryReach} />
          <InsightStat label="Messages started (30d)" value={insights.messagesStarted} />
          <InsightStat label="Invites accepted" value={insights.invitationsAccepted} />
        </div>
      </section>

      {insights.categoriesUsed.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Categories used</h3>
          <ul className="space-y-1">
            {insights.categoriesUsed.map((c) => (
              <li key={c.name} className="flex justify-between text-sm">
                <span>{c.name}</span>
                <span className="text-muted-foreground">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InsightStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
