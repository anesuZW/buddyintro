/** Simulation seed markers and volume targets. */
export const SIM_MARKER = "[sim-seed]";
export const SIM_EMAIL_DOMAIN = "@simulation.buddyintro.test";
export const SIM_PASSWORD = "SimPass123!";

export const TARGETS = {
  users: 1000,
  trustRelationships: 15_000,
  taggedStories: 10_000,
  discoveryPosts: 5_000,
  introductionRequests: 3_000,
  messages: 10_000,
  notifications: 15_000,
} as const;

export type SimulationTargets = {
  users: number;
  trustRelationships: number;
  taggedStories: number;
  discoveryPosts: number;
  introductionRequests: number;
  messages: number;
  notifications: number;
};

/** Scale volume targets for smaller `--users=N` test runs. */
export function resolveTargets(userCount: number = TARGETS.users): SimulationTargets {
  const ratio = userCount / TARGETS.users;
  return {
    users: userCount,
    trustRelationships: Math.round(TARGETS.trustRelationships * ratio),
    taggedStories: Math.round(TARGETS.taggedStories * ratio),
    discoveryPosts: Math.round(TARGETS.discoveryPosts * ratio),
    introductionRequests: Math.round(TARGETS.introductionRequests * ratio),
    messages: Math.round(TARGETS.messages * ratio),
    notifications: Math.round(TARGETS.notifications * ratio),
  };
}

export const REGIONS = [
  "Zimbabwe",
  "South Africa",
  "Botswana",
  "Kenya",
  "Nigeria",
  "UK diaspora",
] as const;

export type SimRegion = (typeof REGIONS)[number];

export const SEED_RNG = 42;
