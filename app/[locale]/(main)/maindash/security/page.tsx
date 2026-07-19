"use client";

import { useEffect, useState } from "react";

export default function SecurityPage() {
  const [items, setItems] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/security").then((r) => r.json()),
      fetch("/api/admin/security?view=breakdown").then((r) => r.json()),
    ]).then(([feed, bd]) => {
      setItems(feed.items ?? []);
      setBreakdown(bd.breakdown ?? []);
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Security monitoring</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {breakdown.map((b) => (
          <div key={b.severity} className="card p-3">
            <div className="text-lg font-bold">{b.count}</div>
            <div className="text-xs uppercase text-muted-foreground">{b.severity}</div>
          </div>
        ))}
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Time</th>
              <th className="p-2">Severity</th>
              <th className="p-2">Type</th>
              <th className="p-2">User</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="p-2">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="p-2">{e.severity}</td>
                <td className="p-2">{e.eventType}</td>
                <td className="p-2">{e.user?.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
