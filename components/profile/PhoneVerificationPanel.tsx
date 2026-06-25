"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PhoneVerificationPanel({
  initialPhone,
  phoneVerified,
}: {
  initialPhone: string | null;
  phoneVerified: boolean;
}) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "sent">("idle");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/verification/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("sent");
      if (data.devHint) toast(data.devHint, { duration: 8000 });
      else toast.success("Verification code sent");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/verification/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast.success("Phone verified");
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (phoneVerified) {
    return (
      <div className="card p-6 mt-6">
        <h2 className="font-semibold">Phone verification</h2>
        <p className="text-sm text-muted-foreground mt-1">Your phone number is verified.</p>
      </div>
    );
  }

  return (
    <div className="card p-6 mt-6 space-y-4">
      <h2 className="font-semibold">Verify your phone</h2>
      <p className="text-sm text-muted-foreground">
        Required for messaging and introductions when phone verification is enabled by admin.
      </p>
      {step === "idle" ? (
        <form onSubmit={requestCode} className="space-y-3">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+263774123456"
            required
          />
          <Button disabled={loading}>{loading ? "Sending…" : "Send verification code"}</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <Input value={phone} readOnly className="opacity-70" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            required
          />
          <Button disabled={loading}>{loading ? "Verifying…" : "Confirm code"}</Button>
        </form>
      )}
    </div>
  );
}
