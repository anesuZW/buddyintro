"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { AdminSettings, IntroductionVisibilityMode } from "@prisma/client";
import { STORY_VISIBILITY_MODE_LABELS } from "@/lib/story-visibility-shared";

const MODES: IntroductionVisibilityMode[] = [
  "specific_people_only",
  "mutual_introduction_network",
  "everyone_i_have_introduced",
];

export function StoryVisibilityAdmin({ initial }: { initial: AdminSettings }) {
  const [enableSpecificPeopleVisibility, setEnableSpecificPeopleVisibility] = useState(
    initial.enableSpecificPeopleVisibility
  );
  const [enableMutualIntroductionNetworkVisibility, setEnableMutualIntroductionNetworkVisibility] =
    useState(initial.enableMutualIntroductionNetworkVisibility);
  const [enableEveryoneIntroducedVisibility, setEnableEveryoneIntroducedVisibility] = useState(
    initial.enableEveryoneIntroducedVisibility
  );
  const [defaultStoryVisibilityMode, setDefaultStoryVisibilityMode] = useState(
    initial.defaultStoryVisibilityMode
  );
  const [allowUserVisibilitySelection, setAllowUserVisibilitySelection] = useState(
    initial.allowUserVisibilitySelection
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    const enabledCount = [
      enableSpecificPeopleVisibility,
      enableMutualIntroductionNetworkVisibility,
      enableEveryoneIntroducedVisibility,
    ].filter(Boolean).length;
    if (enabledCount === 0) {
      toast.error("At least one visibility mode must stay enabled");
      return;
    }
    if (!enabledFlags[defaultStoryVisibilityMode]) {
      toast.error("Default mode must be one of the enabled modes");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enableSpecificPeopleVisibility,
          enableMutualIntroductionNetworkVisibility,
          enableEveryoneIntroducedVisibility,
          defaultStoryVisibilityMode,
          allowUserVisibilitySelection,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Story visibility settings saved");
    } catch {
      toast.error("Could not save story visibility settings");
    } finally {
      setSaving(false);
    }
  }

  const enabledFlags: Record<IntroductionVisibilityMode, boolean> = {
    specific_people_only: enableSpecificPeopleVisibility,
    mutual_introduction_network: enableMutualIntroductionNetworkVisibility,
    everyone_i_have_introduced: enableEveryoneIntroducedVisibility,
  };

  return (
    <section className="card p-4 mt-6">
      <h2 className="font-semibold">Story visibility modes</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Trust-first defaults: mutual introduction network. Disabled modes are hidden from users.
      </p>

      <div className="mt-4 space-y-2">
        {MODES.map((mode) => (
          <label key={mode} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={enabledFlags[mode]}
              onChange={(e) => {
                const v = e.target.checked;
                if (mode === "specific_people_only") setEnableSpecificPeopleVisibility(v);
                if (mode === "mutual_introduction_network") setEnableMutualIntroductionNetworkVisibility(v);
                if (mode === "everyone_i_have_introduced") setEnableEveryoneIntroducedVisibility(v);
              }}
            />
            <span>
              <span className="font-medium">{STORY_VISIBILITY_MODE_LABELS[mode].title}</span>
              <span className="block text-xs text-muted-foreground">
                {STORY_VISIBILITY_MODE_LABELS[mode].description}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Default visibility mode</span>
          <select
            className="input w-full mt-1"
            value={defaultStoryVisibilityMode}
            onChange={(e) =>
              setDefaultStoryVisibilityMode(e.target.value as IntroductionVisibilityMode)
            }
          >
            {MODES.filter((m) => enabledFlags[m]).map((mode) => (
              <option key={mode} value={mode}>
                {STORY_VISIBILITY_MODE_LABELS[mode].title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowUserVisibilitySelection}
            onChange={(e) => setAllowUserVisibilitySelection(e.target.checked)}
          />
          Allow users to choose visibility when creating introductions
        </label>
      </div>

      <button type="button" className="btn-primary mt-4" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save visibility settings"}
      </button>
    </section>
  );
}
