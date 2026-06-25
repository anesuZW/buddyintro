/** User-facing copy — introduction platform positioning (not social media). */

import { BRAND } from "@/lib/branding";

export const COPY = {
  appName: BRAND.name,
  tagline: BRAND.tagline,
  appDescription:
    "Introduce people you trust. Discover others through mutual introductions — not random follows.",

  // Terminology (UI only — DB models stay as Story)
  introduction: "Introduction",
  introductions: "Introductions",
  createIntroduction: "New Introduction",
  yourIntroductions: "Your Introductions",
  introductionViewer: "Introduction Viewer",
  introductionExpiry: "Introduction Expiry",
  introducer: "Introducer",
  postIntroduction: "Publish Introduction",

  // Onboarding
  startTrustedNetwork: "Start Building Your Trusted Network",
  discoverThroughIntros: "Discover People Through Introductions",
  buildTrustedConnections: "Build Trusted Connections",
  joinFriendIntro: "Start Building Your Trusted Network",

  // Home / landing — human-centered
  buildTrustedNetwork: "Build Your Trusted Network",
  buildTrustedNetworkBody:
    "Introduce someone important in your life. Help two great people meet. Share the people who make your world better.",
  homeIntroCta: "Introduce someone important in your life.",
  homeIntroSub: "Help two great people meet through your trusted network.",
  notSocialMedia: `${BRAND.name} is an introduction platform — not another social feed. Every connection is explained through trusted introductions.`,

  // Create flow — warm, relationship-first
  createHelper:
    "Introduce someone you know and help others discover trusted people through your recommendation.",
  step1Title: "Who would you like to introduce?",
  step1Hint: `Choose someone already on ${BRAND.name}, or invite someone new into your trusted network.`,
  step2Title: "How do you know them?",
  step2Hint: "Friend, cousin, neighbour, mentor, colleague — relationships matter here.",
  step3Title: "Tell us about this person",
  step3Hint: "How did you meet? What do you enjoy together? What makes them special?",
  step3Prompts: [
    "How did you meet?",
    "What do you enjoy doing together?",
    "What makes them special?",
    "What would someone appreciate about them?",
    "What is a memorable experience you've shared?",
  ],
  step4Title: "Who should see this introduction?",
  step4Hint: "Choose your trusted network or limit visibility to the same relationship category.",
  step5Title: "Invite them now",
  step5Hint: "Send a personal invitation — introductions work best when people actually join.",

  // Shared introducers / trust
  sharedIntroducers: "Shared Introducers",
  sharedIntroducerCount: (n: number) =>
    n === 1 ? "1 Shared Introducer" : `${n} Shared Introducers`,
  youShare: (n: number) =>
    n === 1 ? "You share 1 Shared Introducer" : `You share ${n} Shared Introducers`,
  viewIntroductions: "View Introductions",
  trustScore: "Trust Score",
  trustAndVerification: "Trust & Verification",
  verifiedEmail: "Verified Email",
  verifiedPhone: "Verified Phone",
  verifiedIdentity: "Verified Identity",
  suggestedIntroductions: "Suggested Introductions",
  trustNetworkModal: "Trust Network",
  introducedThrough: "Introduced through",

  // Stats
  peopleYouIntroduced: "People You've Introduced",
  peopleIntroducedToYou: "People Introduced To You",
  mutualConnections: "Mutual Connections",
  trustedIntroductions: "Trusted Introductions",
  recentIntroductions: "Recent Introductions",

  // Profile trust network
  trustNetwork: "Trust Network",
  introducedBy: "Introduced By",
  peopleIntroduced: "People Introduced",
  mutualIntroductions: "Mutual Introductions",
  trustedConnections: "Trusted Connections",
  introductionActivity: "Introduction Activity",
  introductionCount: "Introduction Count",
  mutualConnectionCount: "Mutual Connection Count",

  // Graph
  howYouAreConnected: "How You Are Connected",
  connectedThrough: "Connected through",
  introducedByLabel: "Introduced by",
  mutualIntroduction: "Mutual Introduction",
  trustedConnectionsAway: (n: number) =>
    n === 1 ? "Direct trusted connection" : `${n} trusted connections away`,

  // Categories
  introductionCategory: "Relationship Category",
  visibilityAllMutual: "Mutual introduction network",
  visibilitySameCategory: "Specific people only",
  visibilityEveryoneIntroduced: "Everyone I have introduced",

  // PWA
  installApp: `Install ${BRAND.name}`,
  installHint: "Add to your home screen for trusted introductions on the go.",
} as const;
