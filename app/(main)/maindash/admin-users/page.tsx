"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Role = {
  id: string;
  name: string;
  description: string | null;
  _count: { userRoles: number };
};

export default function AdminUsersPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/roles");
    if (!res.ok) return;
    const data = await res.json();
    setRoles(data.roles ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function assign() {
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roleId }),
    });
    if (res.ok) {
      toast.success("Role assigned");
      load();
    } else toast.error("Could not assign role");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin users & roles</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Assign RBAC roles. Legacy ADMIN_EMAILS users are auto-assigned SuperAdmin.
      </p>

      <div className="card p-4 mt-4 space-y-3">
        <h2 className="font-semibold">Assign role</h2>
        <input
          className="input w-full"
          placeholder="User UUID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <select className="input w-full" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">Select role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn-primary" onClick={assign} disabled={!userId || !roleId}>
          Assign
        </button>
      </div>

      <div className="card p-4 mt-4">
        <h2 className="font-semibold mb-2">System roles</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {roles.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-border pb-2">
                <span>
                  <strong>{r.name}</strong> — {r.description}
                </span>
                <span className="text-muted-foreground">{r._count.userRoles} users</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
