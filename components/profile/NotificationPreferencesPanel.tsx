"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PushEnableButton } from "@/components/notifications/PushEnableButton";

export type NotificationPreferencesSnapshot = {
  enableNotifications: boolean;
  enableIntroductionNotifications: boolean;
  enableInvitationNotifications: boolean;
  enableDiscoveryNotifications: boolean;
  enableMessageNotifications: boolean;
  enableTrustNotifications: boolean;
  enableVerificationNotifications: boolean;
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  enableInAppNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

export function NotificationPreferencesPanel({
  initialPreferences,
}: {
  /** When set, preferences were loaded on the server — skip client fetch on mount. */
  initialPreferences?: NotificationPreferencesSnapshot;
}) {
  const [prefs, setPrefs] = useState<NotificationPreferencesSnapshot | null>(
    initialPreferences ?? null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialPreferences !== undefined) return;
    fetch("/api/notifications/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPrefs(data?.preferences ?? null));
  }, [initialPreferences]);

  async function save(next: Partial<NotificationPreferencesSnapshot>) {
    if (!prefs) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) return null;

  const toggles: Array<{ key: keyof NotificationPreferencesSnapshot; label: string }> = [
    { key: "enableNotifications", label: "Enable notifications" },
    { key: "enableInAppNotifications", label: "In-app notifications" },
    { key: "enablePushNotifications", label: "Push notifications" },
    { key: "enableEmailNotifications", label: "Email notifications" },
    { key: "enableIntroductionNotifications", label: "Introduction notifications" },
    { key: "enableInvitationNotifications", label: "Invitation notifications" },
    { key: "enableDiscoveryNotifications", label: "Discovery notifications" },
    { key: "enableMessageNotifications", label: "Message notifications" },
    { key: "enableTrustNotifications", label: "Trust notifications" },
    { key: "enableVerificationNotifications", label: "Verification notifications" },
  ];

  return (
    <div
      className="card p-6 mt-6 space-y-4"
      data-notification-preferences="hydrated"
      data-initial-ssr={initialPreferences !== undefined}
    >
      <h2 className="font-semibold">Notification preferences</h2>
      {toggles.map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between gap-4">
          <span className="text-sm">{label}</span>
          <input
            type="checkbox"
            checked={Boolean(prefs[key])}
            onChange={(e) => save({ [key]: e.target.checked })}
            className="h-5 w-5"
          />
        </label>
      ))}

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm">Quiet hours</span>
        <input
          type="checkbox"
          checked={prefs.quietHoursEnabled}
          onChange={(e) => save({ quietHoursEnabled: e.target.checked })}
          className="h-5 w-5"
        />
      </label>

      {prefs.quietHoursEnabled && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs">
            Start
            <input
              type="time"
              value={prefs.quietHoursStart ?? "22:00"}
              onChange={(e) => save({ quietHoursStart: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1"
            />
          </label>
          <label className="block text-xs">
            End
            <input
              type="time"
              value={prefs.quietHoursEnd ?? "07:00"}
              onChange={(e) => save({ quietHoursEnd: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1"
            />
          </label>
        </div>
      )}

      <PushEnableButton />

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  );
}
