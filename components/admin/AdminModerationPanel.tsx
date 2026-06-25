"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  createdAt: string;
  reporter: { name: string; email: string };
};

export function AdminModerationPanel() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(reportId: string, status: "dismissed" | "action_taken") {
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, status, resolution: status }),
    });
    if (res.ok) {
      toast.success("Report updated");
      load();
    } else toast.error("Update failed");
  }

  return (
    <div className="card p-6 space-y-4 mt-6">
      <h2 className="font-semibold">Moderation queue</h2>
      {loading && <p className="text-sm text-muted-foreground">Loading reports…</p>}
      {!loading && reports.length === 0 && (
        <p className="text-sm text-muted-foreground">No pending reports.</p>
      )}
      <ul className="space-y-3">
        {reports.map((r) => (
          <li key={r.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="font-medium">{r.reason}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {r.targetType} · {r.targetId.slice(0, 8)}… · by {r.reporter.name}
            </div>
            {r.details && <p className="mt-2 text-xs">{r.details}</p>}
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => resolve(r.id, "dismissed")}>
                Dismiss
              </Button>
              <Button size="sm" onClick={() => resolve(r.id, "action_taken")}>
                Mark action taken
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
