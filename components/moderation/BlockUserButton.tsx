"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

export function BlockUserButton({
  userId,
  initialBlocked = false,
}: {
  userId: string;
  initialBlocked?: boolean;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(
        blocked ? `/api/blocks/${userId}` : "/api/blocks",
        blocked
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            }
      );
      if (!res.ok) throw new Error("Action failed");
      setBlocked(!blocked);
      toast.success(blocked ? "User unblocked" : "User blocked");
    } catch {
      toast.error("Could not update block status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={toggle}>
      {loading ? "…" : blocked ? "Unblock user" : "Block user"}
    </Button>
  );
}
