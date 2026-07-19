"use client";

import { useEffect, useState } from "react";

export default function JobsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    fetch(`/api/admin/jobs?status=${status}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setSummary(d.summary ?? {});
      });
  }, [status]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Background jobs</h1>
      <div className="flex flex-wrap gap-2 mt-3">
        {["pending", "processing", "completed", "failed", "dead"].map((s) => (
          <button
            key={s}
            type="button"
            className={`px-3 py-1 rounded-full text-sm border ${status === s ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s} ({summary[s] ?? 0})
          </button>
        ))}
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Type</th>
              <th className="p-2">Queue</th>
              <th className="p-2">Priority</th>
              <th className="p-2">Status</th>
              <th className="p-2">Attempts</th>
              <th className="p-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {items.map((j) => (
              <tr key={j.id} className="border-b border-border/50">
                <td className="p-2">{j.jobType}</td>
                <td className="p-2">{j.queue}</td>
                <td className="p-2">{j.priority}</td>
                <td className="p-2">{j.status}</td>
                <td className="p-2">{j.attempts}/{j.maxAttempts}</td>
                <td className="p-2 text-xs text-muted-foreground truncate max-w-[200px]">
                  {j.lastError ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
