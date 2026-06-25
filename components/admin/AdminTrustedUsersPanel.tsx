"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AdminTrustedUsersPanel() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  async function grant(trusted: boolean) {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId.trim()}/verification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustedUser: trusted }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      toast.success(trusted ? "Trusted member granted" : "Trusted status removed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyIdentity(verified: boolean) {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId.trim()}/verification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityVerified: verified }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(verified ? "Identity verified" : "Identity verification removed");
    } catch {
      toast.error("Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 space-y-3 mt-6">
      <h2 className="font-semibold">Trusted users & identity</h2>
      <p className="text-xs text-muted-foreground">
        Grant trusted member badge to community leaders, professionals, and long-standing members.
      </p>
      <Input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="User UUID"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={loading} onClick={() => grant(true)}>
          Grant trusted member
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => grant(false)}>
          Revoke trusted
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => verifyIdentity(true)}>
          Verify identity
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => verifyIdentity(false)}>
          Revoke identity
        </Button>
      </div>
    </div>
  );
}
