"use client";

import { useEffect, useState } from "react";

type Health = {
  status: string;
  database: string;
  storage: string;
  queue: string;
  analytics: string;
  graph: string;
  details: Record<string, string | number | boolean>;
  checkedAt: string;
};

export default function SystemHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth);
  }, []);

  if (!health) return <p className="text-muted-foreground">Checking system health…</p>;

  const rows = [
    ["Overall", health.status],
    ["Database", health.database],
    ["Storage", health.storage],
    ["Queue", health.queue],
    ["Analytics", health.analytics],
    ["Trust graph", health.graph],
  ] as const;

  return (
    <div>
      <h1 className="text-2xl font-bold">System health</h1>
      <p className="text-xs text-muted-foreground mt-1">Last check: {health.checkedAt}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        {rows.map(([label, status]) => (
          <div key={label} className="card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold capitalize">{status}</div>
          </div>
        ))}
      </div>
      <div className="card p-4 mt-4">
        <h2 className="font-semibold mb-2">Details</h2>
        <dl className="text-sm grid grid-cols-2 gap-2">
          {Object.entries(health.details).map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
