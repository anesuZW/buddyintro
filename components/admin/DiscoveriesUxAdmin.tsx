"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { AdminSettings } from "@prisma/client";

export function DiscoveriesUxAdmin({ initial }: { initial: AdminSettings }) {
  const [enableDiscoveriesHeroBanner, setEnableDiscoveriesHeroBanner] = useState(
    initial.enableDiscoveriesHeroBanner
  );
  const [enableDiscoveryExpiryIndicators, setEnableDiscoveryExpiryIndicators] = useState(
    initial.enableDiscoveryExpiryIndicators
  );
  const [enableDiscoveryTrustContext, setEnableDiscoveryTrustContext] = useState(
    initial.enableDiscoveryTrustContext
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enableDiscoveriesHeroBanner,
          enableDiscoveryExpiryIndicators,
          enableDiscoveryTrustContext,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Discoveries UX settings saved");
    } catch {
      toast.error("Could not save Discoveries UX settings");
    } finally {
      setSaving(false);
    }
  }

  const toggles = [
    {
      label: "Hero banner (expiry + trust messaging)",
      checked: enableDiscoveriesHeroBanner,
      set: setEnableDiscoveriesHeroBanner,
    },
    {
      label: "Expiry indicators on discovery cards",
      checked: enableDiscoveryExpiryIndicators,
      set: setEnableDiscoveryExpiryIndicators,
    },
    {
      label: "Trust context lines on discovery cards",
      checked: enableDiscoveryTrustContext,
      set: setEnableDiscoveryTrustContext,
    },
  ] as const;

  return (
    <section className="card p-4 mt-6">
      <h2 className="font-semibold">Discoveries UX</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Ephemeral trust-network messaging, expiry badges, and mutual-introduction context.
      </p>
      <div className="mt-4 space-y-2">
        {toggles.map((t) => (
          <label key={t.label} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={t.checked} onChange={(e) => t.set(e.target.checked)} />
            {t.label}
          </label>
        ))}
      </div>
      <button type="button" className="btn-primary mt-4" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save Discoveries UX"}
      </button>
    </section>
  );
}
