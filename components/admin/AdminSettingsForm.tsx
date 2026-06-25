"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { COPY } from "@/lib/copy";
import type { AdminSettings } from "@prisma/client";

export function AdminSettingsForm({ initial }: { initial: AdminSettings }) {
  const [inviteGateEnabled, setInviteGateEnabled] = useState(initial.inviteGateEnabled);
  const [requiredInvites, setRequiredInvites] = useState(initial.requiredInvites);
  const [storyExpiryHours, setStoryExpiryHours] = useState(initial.storyExpiryHours);
  const [postExpiryHours, setPostExpiryHours] = useState(initial.postExpiryHours);
  const [discoveriesEnabled, setDiscoveriesEnabled] = useState(initial.discoveriesEnabled);
  const [discoveriesExpiryHours, setDiscoveriesExpiryHours] = useState(
    initial.discoveriesExpiryHours ?? ""
  );
  const [discoveriesPublicEnabled, setDiscoveriesPublicEnabled] = useState(
    initial.discoveriesPublicEnabled
  );
  const [introductionsNeverExpire, setIntroductionsNeverExpire] = useState(
    initial.introductionsNeverExpire
  );
  const [showConnectionReasons, setShowConnectionReasons] = useState(
    initial.showConnectionReasons
  );
  const [enableIntroductionGraph, setEnableIntroductionGraph] = useState(
    initial.enableIntroductionGraph
  );
  const [allowFirstDegreeDiscovery, setAllowFirstDegreeDiscovery] = useState(
    initial.allowFirstDegreeDiscovery
  );
  const [allowSecondDegreeDiscovery, setAllowSecondDegreeDiscovery] = useState(
    initial.allowSecondDegreeDiscovery
  );
  const [allowThirdDegreeDiscovery, setAllowThirdDegreeDiscovery] = useState(
    initial.allowThirdDegreeDiscovery
  );
  const [allowFourthDegreeDiscovery, setAllowFourthDegreeDiscovery] = useState(
    initial.allowFourthDegreeDiscovery
  );
  const [maxDiscoveryDepth, setMaxDiscoveryDepth] = useState(initial.maxDiscoveryDepth);
  const [showConnectionPaths, setShowConnectionPaths] = useState(initial.showConnectionPaths);
  const [enableTrustScores, setEnableTrustScores] = useState(initial.enableTrustScores);
  const [enableVerificationLayer, setEnableVerificationLayer] = useState(
    initial.enableVerificationLayer
  );
  const [enableIntroductionCategories, setEnableIntroductionCategories] = useState(
    initial.enableIntroductionCategories
  );
  const [allowUserCreatedCategories, setAllowUserCreatedCategories] = useState(
    initial.allowUserCreatedCategories
  );
  const [allowCategoryEditing, setAllowCategoryEditing] = useState(initial.allowCategoryEditing);
  const [requirePhoneVerification, setRequirePhoneVerification] = useState(
    initial.requirePhoneVerification
  );
  const [requireIdentityVerification, setRequireIdentityVerification] = useState(
    initial.requireIdentityVerification
  );
  const [showTrustScores, setShowTrustScores] = useState(initial.showTrustScores);
  const [showSharedIntroducers, setShowSharedIntroducers] = useState(
    initial.showSharedIntroducers
  );
  const [enableSharedIntroducerTrust, setEnableSharedIntroducerTrust] = useState(
    initial.enableSharedIntroducerTrust
  );
  const [showSharedIntroducerCounts, setShowSharedIntroducerCounts] = useState(
    initial.showSharedIntroducerCounts
  );
  const [sharedIntroducerWeight, setSharedIntroducerWeight] = useState(
    initial.sharedIntroducerWeight
  );
  const [minimumSharedIntroducersForMessaging, setMinimumSharedIntroducersForMessaging] =
    useState(initial.minimumSharedIntroducersForMessaging);
  const [minimumSharedIntroducersForDiscovery, setMinimumSharedIntroducersForDiscovery] =
    useState(initial.minimumSharedIntroducersForDiscovery);
  const [enableNotifications, setEnableNotifications] = useState(initial.enableNotifications);
  const [enableInAppNotifications, setEnableInAppNotifications] = useState(
    initial.enableInAppNotifications
  );
  const [enablePushNotifications, setEnablePushNotifications] = useState(
    initial.enablePushNotifications
  );
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(
    initial.enableEmailNotifications
  );
  const [enableIntroductionNotifications, setEnableIntroductionNotifications] = useState(
    initial.enableIntroductionNotifications
  );
  const [enableDiscoveryNotifications, setEnableDiscoveryNotifications] = useState(
    initial.enableDiscoveryNotifications
  );
  const [enableMessageNotifications, setEnableMessageNotifications] = useState(
    initial.enableMessageNotifications
  );
  const [enableTrustNotifications, setEnableTrustNotifications] = useState(
    initial.enableTrustNotifications
  );
  const [enableVerificationNotifications, setEnableVerificationNotifications] = useState(
    initial.enableVerificationNotifications
  );
  const [enableAnnouncementNotifications, setEnableAnnouncementNotifications] = useState(
    initial.enableAnnouncementNotifications
  );
  const [enableIntroductionViewNotifications, setEnableIntroductionViewNotifications] = useState(
    initial.enableIntroductionViewNotifications
  );
  const [enableNotificationDigests, setEnableNotificationDigests] = useState(
    initial.enableNotificationDigests
  );
  const [notificationDigestFrequency, setNotificationDigestFrequency] = useState(
    initial.notificationDigestFrequency
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
          inviteGateEnabled,
          requiredInvites: Number(requiredInvites),
          storyExpiryHours: Number(storyExpiryHours),
          postExpiryHours: Number(postExpiryHours),
          discoveriesEnabled,
          discoveriesExpiryHours:
            discoveriesExpiryHours === "" ? null : Number(discoveriesExpiryHours),
          discoveriesPublicEnabled,
          introductionsNeverExpire,
          showConnectionReasons,
          enableIntroductionGraph,
          allowFirstDegreeDiscovery,
          allowSecondDegreeDiscovery,
          allowThirdDegreeDiscovery,
          allowFourthDegreeDiscovery,
          maxDiscoveryDepth: Number(maxDiscoveryDepth),
          showConnectionPaths,
          discoveriesNetworkDepth: Number(maxDiscoveryDepth),
          enableTrustScores,
          enableVerificationLayer,
          enableIntroductionCategories,
          allowUserCreatedCategories,
          allowCategoryEditing,
          requirePhoneVerification,
          requireIdentityVerification,
          showTrustScores,
          showSharedIntroducers,
          enableSharedIntroducerTrust,
          showSharedIntroducerCounts,
          sharedIntroducerWeight: Number(sharedIntroducerWeight),
          minimumSharedIntroducersForMessaging: Number(minimumSharedIntroducersForMessaging),
          minimumSharedIntroducersForDiscovery: Number(minimumSharedIntroducersForDiscovery),
          enableNotifications,
          enableInAppNotifications,
          enablePushNotifications,
          enableEmailNotifications,
          enableIntroductionNotifications,
          enableDiscoveryNotifications,
          enableMessageNotifications,
          enableTrustNotifications,
          enableVerificationNotifications,
          enableAnnouncementNotifications,
          enableIntroductionViewNotifications,
          enableNotificationDigests,
          notificationDigestFrequency,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      toast.success("Saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card p-6 space-y-4">
      <h2 className="font-semibold">Settings</h2>

      <label className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Enable invite gate</div>
          <div className="text-xs text-muted-foreground">
            Block messaging until users invite enough friends.
          </div>
        </div>
        <input
          type="checkbox"
          checked={inviteGateEnabled}
          onChange={(e) => setInviteGateEnabled(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Required invites</div>
        <Input
          type="number"
          min={0}
          value={requiredInvites}
          onChange={(e) => setRequiredInvites(Number(e.target.value))}
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">{COPY.introductionExpiry} (hours)</div>
        <Input
          type="number"
          min={1}
          max={72}
          value={storyExpiryHours}
          onChange={(e) => setStoryExpiryHours(Number(e.target.value))}
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Post expiry (hours)</div>
        <Input
          type="number"
          min={1}
          max={168}
          value={postExpiryHours}
          onChange={(e) => setPostExpiryHours(Number(e.target.value))}
        />
      </label>

      <hr className="border-border" />
      <h3 className="font-medium text-sm">Discoveries</h3>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Enable Discoveries</div>
        <input
          type="checkbox"
          checked={discoveriesEnabled}
          onChange={(e) => setDiscoveriesEnabled(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Discoveries expiry (hours, empty = permanent)</div>
        <Input
          type="number"
          min={0}
          placeholder="Permanent"
          value={discoveriesExpiryHours}
          onChange={(e) => setDiscoveriesExpiryHours(e.target.value)}
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Allow public discoverability</div>
        <input
          type="checkbox"
          checked={discoveriesPublicEnabled}
          onChange={(e) => setDiscoveriesPublicEnabled(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <hr className="border-border" />
      <h3 className="font-medium text-sm">{COPY.introductions}</h3>

      <label className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Introductions never expire</div>
          <div className="text-xs text-muted-foreground">
            When enabled, introduction cards remain visible forever. When disabled,
            introductions expire with {COPY.introductionExpiry.toLowerCase()} ({storyExpiryHours}h).
          </div>
        </div>
        <input
          type="checkbox"
          checked={introductionsNeverExpire}
          onChange={(e) => setIntroductionsNeverExpire(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <hr className="border-border" />
      <h3 className="font-medium text-sm">Introduction Network</h3>
      <p className="text-xs text-muted-foreground">
        Control how far trusted introductions travel through the discovery graph. The smaller of
        maximum depth and enabled degrees always wins.
      </p>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Enable Introduction Graph</div>
        <input
          type="checkbox"
          checked={enableIntroductionGraph}
          onChange={(e) => setEnableIntroductionGraph(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Allow First-Degree Discovery</div>
        <input
          type="checkbox"
          checked={allowFirstDegreeDiscovery}
          onChange={(e) => setAllowFirstDegreeDiscovery(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Allow Second-Degree Discovery</div>
        <input
          type="checkbox"
          checked={allowSecondDegreeDiscovery}
          onChange={(e) => setAllowSecondDegreeDiscovery(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Allow Third-Degree Discovery</div>
        <input
          type="checkbox"
          checked={allowThirdDegreeDiscovery}
          onChange={(e) => setAllowThirdDegreeDiscovery(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Allow Fourth-Degree Discovery</div>
        <input
          type="checkbox"
          checked={allowFourthDegreeDiscovery}
          onChange={(e) => setAllowFourthDegreeDiscovery(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">Maximum Discovery Depth</legend>
        {[1, 2, 3, 4].map((depth) => (
          <label key={depth} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="maxDiscoveryDepth"
              value={depth}
              checked={maxDiscoveryDepth === depth}
              onChange={() => setMaxDiscoveryDepth(depth)}
            />
            {depth}
          </label>
        ))}
      </fieldset>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Show Connection Reasons</div>
        <input
          type="checkbox"
          checked={showConnectionReasons}
          onChange={(e) => setShowConnectionReasons(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Show Connection Paths</div>
        <input
          type="checkbox"
          checked={showConnectionPaths}
          onChange={(e) => setShowConnectionPaths(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <hr className="border-border" />
      <h3 className="font-medium text-sm">Trust & Shared Introducers</h3>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Enable trust scores</div>
        <input
          type="checkbox"
          checked={enableTrustScores}
          onChange={(e) => setEnableTrustScores(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Show trust scores</div>
        <input
          type="checkbox"
          checked={showTrustScores}
          onChange={(e) => setShowTrustScores(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Enable shared introducer trust</div>
        <input
          type="checkbox"
          checked={enableSharedIntroducerTrust}
          onChange={(e) => setEnableSharedIntroducerTrust(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Show shared introducers</div>
        <input
          type="checkbox"
          checked={showSharedIntroducers}
          onChange={(e) => setShowSharedIntroducers(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Show shared introducer counts</div>
        <input
          type="checkbox"
          checked={showSharedIntroducerCounts}
          onChange={(e) => setShowSharedIntroducerCounts(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Shared introducer weight (%)</div>
        <Input
          type="number"
          min={0}
          max={100}
          value={sharedIntroducerWeight}
          onChange={(e) => setSharedIntroducerWeight(Number(e.target.value))}
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Minimum shared introducers for messaging</div>
        <Input
          type="number"
          min={0}
          max={50}
          value={minimumSharedIntroducersForMessaging}
          onChange={(e) => setMinimumSharedIntroducersForMessaging(Number(e.target.value))}
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Minimum shared introducers for discovery</div>
        <Input
          type="number"
          min={0}
          max={50}
          value={minimumSharedIntroducersForDiscovery}
          onChange={(e) => setMinimumSharedIntroducersForDiscovery(Number(e.target.value))}
        />
      </label>

      <hr className="border-border" />
      <h3 className="font-medium text-sm">Verification</h3>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Enable verification layer</div>
        <input
          type="checkbox"
          checked={enableVerificationLayer}
          onChange={(e) => setEnableVerificationLayer(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Require phone verification</div>
        <input
          type="checkbox"
          checked={requirePhoneVerification}
          onChange={(e) => setRequirePhoneVerification(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Require identity verification</div>
        <input
          type="checkbox"
          checked={requireIdentityVerification}
          onChange={(e) => setRequireIdentityVerification(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <hr className="border-border" />
      <h3 className="font-medium text-sm">Introduction Categories</h3>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Enable introduction categories</div>
        <input
          type="checkbox"
          checked={enableIntroductionCategories}
          onChange={(e) => setEnableIntroductionCategories(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Allow user-created categories</div>
        <input
          type="checkbox"
          checked={allowUserCreatedCategories}
          onChange={(e) => setAllowUserCreatedCategories(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Allow category editing</div>
        <input
          type="checkbox"
          checked={allowCategoryEditing}
          onChange={(e) => setAllowCategoryEditing(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <hr className="border-border" />
      <h3 className="font-medium text-sm">Notifications</h3>

      {(
        [
          ["Enable notifications", enableNotifications, setEnableNotifications],
          ["Enable in-app", enableInAppNotifications, setEnableInAppNotifications],
          ["Enable push", enablePushNotifications, setEnablePushNotifications],
          ["Enable email", enableEmailNotifications, setEnableEmailNotifications],
          ["Introduction notifications", enableIntroductionNotifications, setEnableIntroductionNotifications],
          ["Discovery notifications", enableDiscoveryNotifications, setEnableDiscoveryNotifications],
          ["Message notifications", enableMessageNotifications, setEnableMessageNotifications],
          ["Trust notifications", enableTrustNotifications, setEnableTrustNotifications],
          ["Verification notifications", enableVerificationNotifications, setEnableVerificationNotifications],
          ["Announcement notifications", enableAnnouncementNotifications, setEnableAnnouncementNotifications],
          ["Introduction view notifications", enableIntroductionViewNotifications, setEnableIntroductionViewNotifications],
          ["Notification digests", enableNotificationDigests, setEnableNotificationDigests],
        ] as const
      ).map(([label, value, setter]) => (
        <label key={label} className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{label}</span>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => setter(e.target.checked)}
            className="h-5 w-5"
          />
        </label>
      ))}

      <label className="block">
        <div className="text-sm font-medium mb-1">Digest frequency</div>
        <select
          value={notificationDigestFrequency}
          onChange={(e) =>
            setNotificationDigestFrequency(e.target.value as "instant" | "daily" | "weekly")
          }
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="instant">Instant</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>

      <Button disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}
