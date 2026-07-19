"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AuditRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  admin: { name: string; email: string };
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function load(next?: string) {
    const q = new URLSearchParams({ limit: "20" });
    if (next) q.set("cursor", next);
    const res = await fetch(`/api/admin/audit?${q}`);
    if (!res.ok) return;
    const data = await res.json();
    setItems(next ? [...items, ...data.items] : data.items);
    setNextCursor(data.nextCursor);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit log</h1>
        <Link href="/api/admin/audit?format=csv" className="btn-secondary text-sm">
          Export CSV
        </Link>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="p-2">Time</th>
              <th className="p-2">Admin</th>
              <th className="p-2">Action</th>
              <th className="p-2">Target</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="p-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2">{r.admin.email}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">
                  {r.targetType ?? "—"} {r.targetId ? r.targetId.slice(0, 8) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor && (
        <button type="button" className="btn-secondary mt-3" onClick={() => load(nextCursor)}>
          Load more
        </button>
      )}
    </div>
  );
}
