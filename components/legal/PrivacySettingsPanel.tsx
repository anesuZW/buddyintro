"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export function PrivacySettingsPanel() {
  const [loading, setLoading] = useState<string | null>(null);

  async function exportData() {
    setLoading("export");
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "friendintro-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Could not export data");
    } finally {
      setLoading(null);
    }
  }

  async function withdrawConsent() {
    setLoading("withdraw");
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privacyVersion: LEGAL_VERSIONS.privacy,
          termsVersion: "withdrawn",
          cookieVersion: null,
        }),
      });
      toast.success("Consent preferences updated");
    } catch {
      toast.error("Could not update consent");
    } finally {
      setLoading(null);
    }
  }

  async function deleteAccount() {
    if (!confirm("Delete your account permanently? This cannot be undone.")) return;
    setLoading("delete");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Account deleted");
      window.location.href = "/";
    } catch {
      toast.error("Could not delete account");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card p-6 space-y-4 mt-6">
      <h2 className="font-semibold">Privacy & data</h2>
      <p className="text-sm text-muted-foreground">
        Manage your consent, download your data, or delete your account.
      </p>
      <div className="flex flex-col gap-2">
        <Button variant="outline" disabled={loading !== null} onClick={exportData}>
          {loading === "export" ? "Preparing…" : "Download my data"}
        </Button>
        <Button variant="outline" disabled={loading !== null} onClick={withdrawConsent}>
          {loading === "withdraw" ? "Updating…" : "Withdraw marketing consent"}
        </Button>
        <Button variant="destructive" disabled={loading !== null} onClick={deleteAccount}>
          {loading === "delete" ? "Deleting…" : "Delete account"}
        </Button>
      </div>
    </div>
  );
}
