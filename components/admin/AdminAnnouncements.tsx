"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AdminAnnouncements() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"announcement" | "maintenance" | "policy">("announcement");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, kind }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send");
      }
      toast.success("Announcement sent");
      setTitle("");
      setMessage("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="card p-6 space-y-4 mt-6">
      <h2 className="font-semibold">Broadcast announcement</h2>
      <label className="block">
        <div className="text-sm font-medium mb-1">Type</div>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="announcement">Important announcement</option>
          <option value="maintenance">Maintenance</option>
          <option value="policy">Policy update</option>
        </select>
      </label>
      <label className="block">
        <div className="text-sm font-medium mb-1">Title</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </label>
      <label className="block">
        <div className="text-sm font-medium mb-1">Message</div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={1000}
          rows={4}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <Button disabled={sending}>{sending ? "Sending…" : "Send to all users"}</Button>
    </form>
  );
}
