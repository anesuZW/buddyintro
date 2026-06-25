export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_STORAGE_BUCKET || "friendintro";

export const STORY_DEFAULTS = {
  expiryHours: 24,
  segmentSeconds: 6,
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export const ROUTES = {
  home: "/home",
  stories: "/stories",
  discoveries: "/discoveries",
  introductions: "/introductions",
  createStory: "/create-story",
  messages: "/messages",
  profile: "/profile",
  admin: "/maindash",
  legacyAdmin: "/admin",
  login: "/login",
  signup: "/signup",
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
} as const;
