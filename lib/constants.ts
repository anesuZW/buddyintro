export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_STORAGE_BUCKET || "friendintro";

export const STORY_DEFAULTS = {
  expiryHours: 24,
  segmentSeconds: 6,
};

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_UPLOAD_MB = 100;
/** Multipart envelope overhead allowed above file-size limit for Content-Length pre-check. */
export const MULTIPART_UPLOAD_SLACK_BYTES = 1024 * 1024; // 1MB
/** Maximum voice note recording duration in seconds. */
export const MAX_VOICE_RECORD_SECONDS = 120;
/** Maximum story / discovery video duration (client validation). */
export const MAX_VIDEO_DURATION_SECONDS = 90;
/** Reject images larger than this on either edge (client validation). */
export const MAX_IMAGE_EDGE_PX = 8192;

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
