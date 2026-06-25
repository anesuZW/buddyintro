import type { AdminSettings } from "@prisma/client";

export const STORY_VISIBILITY_MODES = {
  SPECIFIC_PEOPLE_ONLY: "specific_people_only",
  MUTUAL_INTRODUCTION_NETWORK: "mutual_introduction_network",
  EVERYONE_I_HAVE_INTRODUCED: "everyone_i_have_introduced",
} as const;

export type StoryVisibilityModeValue =
  (typeof STORY_VISIBILITY_MODES)[keyof typeof STORY_VISIBILITY_MODES];

export const STORY_VISIBILITY_MODE_LABELS: Record<
  StoryVisibilityModeValue,
  { title: string; description: string }
> = {
  specific_people_only: {
    title: "Specific people only",
    description: "Only the people you tag on this introduction can see it.",
  },
  mutual_introduction_network: {
    title: "Mutual introduction network",
    description: "Visible to tagged people and others in your trusted introduction network.",
  },
  everyone_i_have_introduced: {
    title: "Everyone I have introduced",
    description: "Visible to anyone you have previously introduced, including this one.",
  },
};

const ALL_MODES = Object.values(STORY_VISIBILITY_MODES);

export function isStoryVisibilityMode(value: string): value is StoryVisibilityModeValue {
  return ALL_MODES.includes(value as StoryVisibilityModeValue);
}

export function getEnabledStoryVisibilityModes(
  settings: AdminSettings
): StoryVisibilityModeValue[] {
  const modes: StoryVisibilityModeValue[] = [];
  if (settings.enableSpecificPeopleVisibility) {
    modes.push(STORY_VISIBILITY_MODES.SPECIFIC_PEOPLE_ONLY);
  }
  if (settings.enableMutualIntroductionNetworkVisibility) {
    modes.push(STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK);
  }
  if (settings.enableEveryoneIntroducedVisibility) {
    modes.push(STORY_VISIBILITY_MODES.EVERYONE_I_HAVE_INTRODUCED);
  }
  if (!modes.length) {
    modes.push(STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK);
  }
  return modes;
}

export function resolveDefaultStoryVisibilityMode(
  settings: AdminSettings
): StoryVisibilityModeValue {
  const enabled = getEnabledStoryVisibilityModes(settings);
  const preferred = settings.defaultStoryVisibilityMode as StoryVisibilityModeValue;
  if (enabled.includes(preferred)) return preferred;
  return enabled[0];
}

export function assertStoryVisibilityModeAllowed(
  mode: string,
  settings: AdminSettings
): void {
  const enabled = getEnabledStoryVisibilityModes(settings);
  if (!enabled.includes(mode as StoryVisibilityModeValue)) {
    throw new Error("This visibility mode is not enabled on the platform.");
  }
}

/** Resolve the mode to persist, honoring admin default and selection lock. */
export function resolveStoryVisibilityMode(
  requested: string | undefined | null,
  settings: AdminSettings
): StoryVisibilityModeValue {
  if (!settings.allowUserVisibilitySelection) {
    return resolveDefaultStoryVisibilityMode(settings);
  }
  if (!requested) {
    return resolveDefaultStoryVisibilityMode(settings);
  }
  if (!isStoryVisibilityMode(requested)) {
    throw new Error("Invalid visibility mode.");
  }
  assertStoryVisibilityModeAllowed(requested, settings);
  return requested;
}

/** Client-safe visibility config for story creation UI. */
export function serializeStoryVisibilityConfig(settings: AdminSettings) {
  const enabledModes = getEnabledStoryVisibilityModes(settings);
  return {
    enabledModes,
    defaultMode: resolveDefaultStoryVisibilityMode(settings),
    allowUserSelection: settings.allowUserVisibilitySelection,
    labels: STORY_VISIBILITY_MODE_LABELS,
  };
}

/** Normalize admin visibility patch so default is always an enabled mode. */
export function normalizeVisibilityAdminPatch(
  current: AdminSettings,
  patch: Partial<AdminSettings>
): Partial<AdminSettings> {
  const merged = { ...current, ...patch };
  let enableSpecific = merged.enableSpecificPeopleVisibility;
  let enableMutual = merged.enableMutualIntroductionNetworkVisibility;
  let enableEveryone = merged.enableEveryoneIntroducedVisibility;

  if (!enableSpecific && !enableMutual && !enableEveryone) {
    enableMutual = true;
  }

  const normalizedSettings = {
    ...merged,
    enableSpecificPeopleVisibility: enableSpecific,
    enableMutualIntroductionNetworkVisibility: enableMutual,
    enableEveryoneIntroducedVisibility: enableEveryone,
  };

  const enabled = getEnabledStoryVisibilityModes(normalizedSettings);
  let defaultMode = merged.defaultStoryVisibilityMode as StoryVisibilityModeValue;
  if (!enabled.includes(defaultMode)) {
    defaultMode = enabled[0];
  }

  return {
    ...patch,
    enableSpecificPeopleVisibility: enableSpecific,
    enableMutualIntroductionNetworkVisibility: enableMutual,
    enableEveryoneIntroducedVisibility: enableEveryone,
    defaultStoryVisibilityMode: defaultMode,
  };
}
