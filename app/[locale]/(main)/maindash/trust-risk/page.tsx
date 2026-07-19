"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function TrustRiskPage() {
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const res = await fetch("/api/admin/trust-risk?minLevel=medium");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(userId: string, action: string) {
    const res = await fetch(`/api/admin/trust-risk/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      toast.success("Updated");
      load();
    } else toast.error("Action failed");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Trust risk review</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Automated trust-abuse signals. Review clusters, suspend, or mark false positives.
      </p>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">User</th>
              <th className="p-2">Score</th>
              <th className="p-2">Level</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-border/50">
                <td className="p-2">{u.name} ({u.email})</td>
                <td className="p-2">{u.trustRiskScore}</td>
                <td className="p-2">{u.trustRiskLevel}</td>
                <td className="p-2 space-x-1">
                  <button type="button" className="btn-secondary text-xs" onClick={() => act(u.id, "suspend")}>
                    Suspend
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => act(u.id, "reset_trust")}>
                    Reset trust
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => act(u.id, "false_positive")}>
                    False +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
