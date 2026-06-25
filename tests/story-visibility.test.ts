import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STORY_VISIBILITY_MODES,
  assertStoryVisibilityModeAllowed,
  getEnabledStoryVisibilityModes,
  normalizeVisibilityAdminPatch,
  resolveDefaultStoryVisibilityMode,
  resolveStoryVisibilityMode,
} from "@/lib/story-visibility-shared";
import type { AdminSettings } from "@prisma/client";

const baseSettings = {
  enableSpecificPeopleVisibility: false,
  enableMutualIntroductionNetworkVisibility: true,
  enableEveryoneIntroducedVisibility: false,
  defaultStoryVisibilityMode: "mutual_introduction_network",
  allowUserVisibilitySelection: true,
} as AdminSettings;

describe("story visibility modes", () => {
  it("defaults to mutual introduction network", () => {
    assert.equal(
      resolveDefaultStoryVisibilityMode(baseSettings),
      STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK
    );
  });

  it("rejects disabled visibility modes", () => {
    assert.throws(
      () =>
        assertStoryVisibilityModeAllowed(
          STORY_VISIBILITY_MODES.SPECIFIC_PEOPLE_ONLY,
          baseSettings
        ),
      /not enabled/
    );
  });

  it("locks visibility when user selection is disabled", () => {
    const locked = {
      ...baseSettings,
      allowUserVisibilitySelection: false,
      defaultStoryVisibilityMode: "mutual_introduction_network" as const,
    };
    assert.equal(
      resolveStoryVisibilityMode(STORY_VISIBILITY_MODES.SPECIFIC_PEOPLE_ONLY, locked),
      STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK
    );
  });

  it("falls back default when admin disables the configured default mode", () => {
    const patch = normalizeVisibilityAdminPatch(baseSettings, {
      enableMutualIntroductionNetworkVisibility: false,
      enableSpecificPeopleVisibility: true,
      defaultStoryVisibilityMode: "mutual_introduction_network",
    });
    assert.equal(patch.defaultStoryVisibilityMode, "specific_people_only");
    assert.equal(patch.enableSpecificPeopleVisibility, true);
  });

  it("always keeps at least one enabled mode", () => {
    const patch = normalizeVisibilityAdminPatch(baseSettings, {
      enableMutualIntroductionNetworkVisibility: false,
      enableSpecificPeopleVisibility: false,
      enableEveryoneIntroducedVisibility: false,
    });
    assert.equal(patch.enableMutualIntroductionNetworkVisibility, true);
  });

  it("lists only enabled modes for UI", () => {
    const modes = getEnabledStoryVisibilityModes(baseSettings);
    assert.deepEqual(modes, [STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK]);
  });
});
