"use client";

import { useEffect, useState } from "react";

type Summary = {
  totalRequests: number;
  avgDurationMs: number;
  avgQueryCount: number;
  slowestRoutes: Array<{ label: string; avgMs: number; count: number }>;
  slowestApis: Array<{ label: string; avgMs: number; count: number }>;
  topSlowQueries: Array<{ model: string; action: string; avgMs: number; count: number }>;
};

type PerfRecord = {
  id: string;
  kind: string;
  label: string;
  method?: string;
  durationMs: number;
  queryCount: number;
  slowQueries: Array<{ model: string; action: string; durationMs: number }>;
  timestamp: number;
};

export function PerformanceDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [records, setRecords] = useState<PerfRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/performance");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setRecords(data.records ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  if (loading && !summary) {
    return <div className="text-sm text-muted-foreground">Loading performance data…</div>;
  }

  if (!summary) {
    return <div className="text-sm text-muted-foreground">No performance data yet. Navigate the app to collect samples.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          In-memory metrics since last deploy. Refreshes every 15s.
        </p>
        <button type="button" className="btn-ghost text-sm" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Samples" value={String(summary.totalRequests)} />
        <Stat label="Avg response" value={`${summary.avgDurationMs} ms`} />
        <Stat label="Avg queries" value={String(summary.avgQueryCount)} />
      </div>

      <Section title="Slowest pages" rows={summary.slowestRoutes} />
      <Section title="Slowest APIs" rows={summary.slowestApis} />

      <div>
        <h3 className="text-sm font-semibold mb-2">Top slow Prisma queries (&gt;200ms)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Avg ms</th>
                <th className="py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {summary.topSlowQueries.map((q) => (
                <tr key={`${q.model}.${q.action}`} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-xs">{q.model}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{q.action}</td>
                  <td className="py-2 pr-4">{q.avgMs}</td>
                  <td className="py-2">{q.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Recent requests</h3>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border sticky top-0 bg-background">
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Ms</th>
                <th className="py-2 pr-3">Queries</th>
                <th className="py-2">Slow</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-xs">{r.kind}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.label}</td>
                  <td className="py-1.5 pr-3">{r.durationMs}</td>
                  <td className="py-1.5 pr-3">{r.queryCount}</td>
                  <td className="py-1.5 text-xs text-muted-foreground">
                    {r.slowQueries.length ? r.slowQueries.map((s) => `${s.model}.${s.action}`).join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4 bg-fi-card border-primary/10">
      <div className="text-xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; avgMs: number; count: number }>;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between text-sm py-1.5 border-b border-border/50"
          >
            <span className="font-mono text-xs">{r.label}</span>
            <span className="text-muted-foreground">
              {r.avgMs} ms avg · {r.count}×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
