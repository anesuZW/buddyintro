"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";

const REASONS = [
  "Spam or scam",
  "Harassment",
  "Inappropriate content",
  "Impersonation",
  "Other",
];

export function ReportContentButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: "user" | "story" | "discoveries_post" | "message";
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, details }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Report failed");
      }
      toast.success("Report submitted. Our team will review it.");
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Report failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        onClick={() => setOpen(true)}
      >
        <Flag size={12} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form onSubmit={submit} className="card p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold">Report content</h3>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={sending}>{sending ? "Sending…" : "Submit report"}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
