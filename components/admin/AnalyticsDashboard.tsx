"use client";



import { useCallback, useEffect, useState } from "react";

import type { AnalyticsMetricsResult, LeaderboardEntry } from "@/services/analytics/types";



const RANGES = [

  { days: 7, label: "7 days" },

  { days: 30, label: "30 days" },

  { days: 90, label: "90 days" },

  { days: 365, label: "1 year" },

];



function Metric({ label, value }: { label: string; value: number | string }) {

  return (

    <div className="rounded-2xl bg-muted p-3">

      <div className="text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>

      <div className="text-[10px] text-muted-foreground">{label}</div>

    </div>

  );

}



function Leaderboard({ title, items }: { title: string; items: LeaderboardEntry[] }) {

  if (!items.length) return null;

  return (

    <div>

      <h3 className="text-sm font-medium mb-2">{title}</h3>

      <ul className="space-y-1">

        {items.map((item) => (

          <li key={item.userId} className="flex justify-between text-sm">

            <span>{item.name}</span>

            <span className="text-muted-foreground">{item.value.toLocaleString()}</span>

          </li>

        ))}

      </ul>

    </div>

  );

}



export function AnalyticsDashboard() {

  const [days, setDays] = useState(30);

  const [metrics, setMetrics] = useState<AnalyticsMetricsResult | null>(null);

  const [loading, setLoading] = useState(true);



  const load = useCallback(async () => {

    setLoading(true);

    try {

      const res = await fetch(`/api/admin/analytics?days=${days}`);

      if (res.ok) {

        const data = await res.json();

        setMetrics(data.metrics);

      }

    } finally {

      setLoading(false);

    }

  }, [days]);



  useEffect(() => {

    load();

  }, [load]);



  const maxChart = metrics?.chart.reduce((m, c) => Math.max(m, c.count), 1) ?? 1;



  return (

    <div className="card p-6 space-y-4 mt-6">

      <div className="flex items-center justify-between gap-2 flex-wrap">

        <h2 className="font-semibold">Analytics Dashboard</h2>

        <div className="flex gap-1">

          {RANGES.map((r) => (

            <button

              key={r.days}

              type="button"

              onClick={() => setDays(r.days)}

              className={`px-2 py-1 rounded-lg text-xs ${

                days === r.days ? "bg-primary text-primary-foreground" : "bg-muted"

              }`}

            >

              {r.label}

            </button>

          ))}

        </div>

      </div>



      {loading && <p className="text-sm text-muted-foreground">Loading metrics…</p>}



      {metrics && !loading && (

        <>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">

            <Metric label="Daily active users" value={metrics.dailyActiveUsers} />

            <Metric label="Monthly active users" value={metrics.monthlyActiveUsers} />

            <Metric label="Introductions created" value={metrics.introductionsCreated} />

            <Metric label="Introductions viewed" value={metrics.introductionsViewed} />

            <Metric label="Invites sent" value={metrics.invitesSent} />

            <Metric label="Invites accepted" value={metrics.invitesAccepted} />

            <Metric label="Discovery engagement" value={metrics.discoveryEngagement} />

            <Metric label="Messages sent" value={metrics.messagesSent} />

            <Metric label="Trust connections" value={metrics.trustConnectionsCreated} />

            <Metric label="Shared introducers" value={metrics.sharedIntroducersGenerated} />

            <Metric label="Verifications" value={metrics.verificationConversions} />

          </div>



          <div className="grid md:grid-cols-2 gap-6 pt-2">

            <div className="space-y-4">

              <h3 className="text-sm font-semibold border-b pb-1">Trust metrics</h3>

              <Leaderboard title="Most trusted users" items={metrics.trustMetrics.mostTrustedUsers} />

              <Leaderboard title="Top shared introducers" items={metrics.trustMetrics.topSharedIntroducers} />

              <Leaderboard title="Most connected users" items={metrics.trustMetrics.mostConnectedUsers} />

              <Leaderboard title="Highest trust scores" items={metrics.trustMetrics.highestTrustScores} />

              <Leaderboard title="Fastest growing trust networks" items={metrics.trustMetrics.fastestGrowingNetworks} />

            </div>



            <div className="space-y-4">

              <h3 className="text-sm font-semibold border-b pb-1">Introduction metrics</h3>

              <div className="grid grid-cols-2 gap-2">

                <Metric label="Created" value={metrics.introductionMetrics.created} />

                <Metric label="Viewed" value={metrics.introductionMetrics.viewed} />

                <Metric label="Replied" value={metrics.introductionMetrics.replied} />

                <Metric label="Accepted" value={metrics.introductionMetrics.accepted} />

                <Metric label="Acceptance rate" value={`${metrics.introductionMetrics.acceptanceRate}%`} />

              </div>



              <h3 className="text-sm font-semibold border-b pb-1 pt-2">Discovery metrics</h3>

              <div className="grid grid-cols-3 gap-2">

                <Metric label="Views" value={metrics.discoveryMetrics.views} />

                <Metric label="Messages" value={metrics.discoveryMetrics.messages} />

                <Metric label="Shares" value={metrics.discoveryMetrics.shares} />

              </div>



              <h3 className="text-sm font-semibold border-b pb-1 pt-2">Verification metrics</h3>

              <div className="grid grid-cols-3 gap-2">

                <Metric label="Phone verified" value={metrics.verificationMetrics.phoneVerified} />

                <Metric label="Identity verified" value={metrics.verificationMetrics.identityVerified} />

                <Metric label="Trusted users" value={metrics.verificationMetrics.trustedUsers} />

              </div>

            </div>

          </div>



          {metrics.chart.length > 0 && (

            <div>

              <h3 className="text-sm font-medium mb-2">Activity</h3>

              <div className="flex items-end gap-1 h-24">

                {metrics.chart.map((point) => (

                  <div

                    key={point.date}

                    className="flex-1 min-w-0 flex flex-col items-center gap-1"

                    title={`${point.date}: ${point.count}`}

                  >

                    <div

                      className="w-full bg-primary/70 rounded-t"

                      style={{ height: `${Math.max(4, (point.count / maxChart) * 100)}%` }}

                    />

                    <span className="text-[8px] text-muted-foreground truncate w-full text-center">

                      {point.date.slice(5)}

                    </span>

                  </div>

                ))}

              </div>

            </div>

          )}



          {(metrics.topCategories.length > 0 || metrics.categoryMetrics.length > 0) && (

            <div className="grid md:grid-cols-2 gap-6">

              {metrics.topCategories.length > 0 && (

                <div>

                  <h3 className="text-sm font-medium mb-2">Top introduction categories</h3>

                  <ul className="space-y-1">

                    {metrics.topCategories.map((c) => (

                      <li key={c.name} className="flex justify-between text-sm">

                        <span>{c.name}</span>

                        <span className="text-muted-foreground">{c.count}</span>

                      </li>

                    ))}

                  </ul>

                </div>

              )}

              {metrics.categoryMetrics.length > 0 && (

                <div>

                  <h3 className="text-sm font-medium mb-2">Category joins</h3>

                  <ul className="space-y-1">

                    {metrics.categoryMetrics.map((c) => (

                      <li key={c.name} className="flex justify-between text-sm">

                        <span>{c.name}</span>

                        <span className="text-muted-foreground">{c.count}</span>

                      </li>

                    ))}

                  </ul>

                </div>

              )}

            </div>

          )}

        </>

      )}

    </div>

  );

}

