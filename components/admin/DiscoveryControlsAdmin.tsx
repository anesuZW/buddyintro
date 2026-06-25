"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AdminSettings } from "@prisma/client";

export function DiscoveryControlsAdmin({ initial }: { initial: AdminSettings }) {
  const [enableDiscoveryControls, setEnableDiscoveryControls] = useState(
    initial.enableDiscoveryControls
  );
  const [allowCrossCategoryDiscovery, setAllowCrossCategoryDiscovery] = useState(
    initial.allowCrossCategoryDiscovery
  );
  const [allowDiscoveryMessaging, setAllowDiscoveryMessaging] = useState(
    initial.allowDiscoveryMessaging
  );
  const [requireSharedIntroducerForDiscovery, setRequireSharedIntroducerForDiscovery] =
    useState(initial.requireSharedIntroducerForDiscovery);
  const [requireSharedIntroducerForMessaging, setRequireSharedIntroducerForMessaging] =
    useState(initial.requireSharedIntroducerForMessaging);
  const [hideDiscoveryFromUnverifiedUsers, setHideDiscoveryFromUnverifiedUsers] = useState(
    initial.hideDiscoveryFromUnverifiedUsers
  );
  const [minimumSharedIntroducersForDiscovery, setMinimumSharedIntroducersForDiscovery] =
    useState(initial.minimumSharedIntroducersForDiscovery);
  const [minimumSharedIntroducersForMessaging, setMinimumSharedIntroducersForMessaging] =
    useState(initial.minimumSharedIntroducersForMessaging);
  const [enableGranularVerificationGates, setEnableGranularVerificationGates] = useState(
    initial.enableGranularVerificationGates
  );
  const [enableBackgroundJobs, setEnableBackgroundJobs] = useState(initial.enableBackgroundJobs);
  const [enableTrustRankings, setEnableTrustRankings] = useState(initial.enableTrustRankings);
  const [enableTrustRecommendations, setEnableTrustRecommendations] = useState(
    initial.enableTrustRecommendations
  );
  const [requireEmailVerification, setRequireEmailVerification] = useState(
    initial.requireEmailVerification
  );
  const [messagingRequirePhone, setMessagingRequirePhone] = useState(initial.messagingRequirePhone);
  const [messagingRequireEmail, setMessagingRequireEmail] = useState(initial.messagingRequireEmail);
  const [messagingRequireIdentity, setMessagingRequireIdentity] = useState(
    initial.messagingRequireIdentity
  );
  const [discoveriesRequirePhone, setDiscoveriesRequirePhone] = useState(
    initial.discoveriesRequirePhone
  );
  const [discoveriesRequireEmail, setDiscoveriesRequireEmail] = useState(
    initial.discoveriesRequireEmail
  );
  const [discoveriesRequireIdentity, setDiscoveriesRequireIdentity] = useState(
    initial.discoveriesRequireIdentity
  );
  const [introductionsRequirePhone, setIntroductionsRequirePhone] = useState(
    initial.introductionsRequirePhone
  );
  const [introductionsRequireEmail, setIntroductionsRequireEmail] = useState(
    initial.introductionsRequireEmail
  );
  const [introductionsRequireIdentity, setIntroductionsRequireIdentity] = useState(
    initial.introductionsRequireIdentity
  );
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enableDiscoveryControls,
          allowCrossCategoryDiscovery,
          allowDiscoveryMessaging,
          requireSharedIntroducerForDiscovery,
          requireSharedIntroducerForMessaging,
          hideDiscoveryFromUnverifiedUsers,
          minimumSharedIntroducersForDiscovery: Number(minimumSharedIntroducersForDiscovery),
          minimumSharedIntroducersForMessaging: Number(minimumSharedIntroducersForMessaging),
          enableGranularVerificationGates,
          enableBackgroundJobs,
          enableTrustRankings,
          enableTrustRecommendations,
          requireEmailVerification,
          messagingRequirePhone,
          messagingRequireEmail,
          messagingRequireIdentity,
          discoveriesRequirePhone,
          discoveriesRequireEmail,
          discoveriesRequireIdentity,
          introductionsRequirePhone,
          introductionsRequireEmail,
          introductionsRequireIdentity,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Discovery & trust controls saved");
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  const toggles: Array<[string, boolean, (v: boolean) => void]> = [
    ["Enable discovery safety controls", enableDiscoveryControls, setEnableDiscoveryControls],
    ["Allow cross-category discovery", allowCrossCategoryDiscovery, setAllowCrossCategoryDiscovery],
    ["Allow discovery messaging", allowDiscoveryMessaging, setAllowDiscoveryMessaging],
    [
      "Require shared introducer for discovery",
      requireSharedIntroducerForDiscovery,
      setRequireSharedIntroducerForDiscovery,
    ],
    [
      "Require shared introducer for messaging",
      requireSharedIntroducerForMessaging,
      setRequireSharedIntroducerForMessaging,
    ],
    [
      "Hide discovery from unverified users",
      hideDiscoveryFromUnverifiedUsers,
      setHideDiscoveryFromUnverifiedUsers,
    ],
    ["Granular verification gates", enableGranularVerificationGates, setEnableGranularVerificationGates],
    ["Background job queue", enableBackgroundJobs, setEnableBackgroundJobs],
    ["Trust rankings", enableTrustRankings, setEnableTrustRankings],
    ["Trust recommendations", enableTrustRecommendations, setEnableTrustRecommendations],
    ["Require email verification (legacy)", requireEmailVerification, setRequireEmailVerification],
    ["Messaging requires phone", messagingRequirePhone, setMessagingRequirePhone],
    ["Messaging requires email", messagingRequireEmail, setMessagingRequireEmail],
    ["Messaging requires identity", messagingRequireIdentity, setMessagingRequireIdentity],
    ["Discoveries require phone", discoveriesRequirePhone, setDiscoveriesRequirePhone],
    ["Discoveries require email", discoveriesRequireEmail, setDiscoveriesRequireEmail],
    ["Discoveries require identity", discoveriesRequireIdentity, setDiscoveriesRequireIdentity],
    ["Introductions require phone", introductionsRequirePhone, setIntroductionsRequirePhone],
    ["Introductions require email", introductionsRequireEmail, setIntroductionsRequireEmail],
    [
      "Introductions require identity",
      introductionsRequireIdentity,
      setIntroductionsRequireIdentity,
    ],
  ];

  return (
    <form onSubmit={save} className="card p-6 space-y-4 mt-6">
      <h2 className="font-semibold">Discovery safety & trust platform</h2>
      <p className="text-xs text-muted-foreground">
        Feature flags default off for backwards compatibility. Enable controls gradually.
      </p>
      {toggles.map(([label, value, setter]) => (
        <label key={label} className="flex items-center justify-between gap-4">
          <span className="text-sm">{label}</span>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => setter(e.target.checked)}
            className="h-5 w-5"
          />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Min shared introducers (discovery)
          <Input
            type="number"
            min={0}
            max={50}
            value={minimumSharedIntroducersForDiscovery}
            onChange={(e) => setMinimumSharedIntroducersForDiscovery(Number(e.target.value))}
            className="mt-1"
          />
        </label>
        <label className="block text-sm">
          Min shared introducers (messaging)
          <Input
            type="number"
            min={0}
            max={50}
            value={minimumSharedIntroducersForMessaging}
            onChange={(e) => setMinimumSharedIntroducersForMessaging(Number(e.target.value))}
            className="mt-1"
          />
        </label>
      </div>
      <Button disabled={saving}>{saving ? "Saving…" : "Save trust platform settings"}</Button>
    </form>
  );
}
