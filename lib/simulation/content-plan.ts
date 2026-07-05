import { randomUUID } from "crypto";
import type { MediaType, StoryStatus } from "@prisma/client";
import { SIM_MARKER, TARGETS, resolveTargets, type SimulationTargets } from "@/lib/simulation/constants";
import type { SimCommunity, SimPersona } from "@/lib/simulation/personas";
import { mulberry32, pick } from "@/lib/simulation/rng";

export type PlannedStory = {
  id: string;
  authorIndex: number;
  taggedIndex: number;
  status: StoryStatus;
  caption: string;
  categoryName: string;
  kind?: "published" | "draft_request";
};

export type PlannedDiscovery = {
  id: string;
  authorIndex: number;
  content: string;
  categoryName: string;
};

export type PlannedMessage = {
  id: string;
  senderIndex: number;
  receiverIndex: number;
  body: string;
  origin: "story" | "discoveries" | "direct";
};

export type PlannedNotification = {
  id: string;
  userIndex: number;
  actorIndex: number | null;
  type: string;
  title: string;
  message: string;
};

const STORY_SCENARIOS = [
  { category: "Business", template: (a: string, b: string, p: SimPersona) => `${a} is introducing ${b} for a ${p.profession.toLowerCase()} collaboration.` },
  { category: "Mentorship", template: (a: string, b: string) => `${a} thinks ${b} would be a great mentor.` },
  { category: "Friend", template: (a: string, b: string, p: SimPersona) => `${a} connecting ${b} — both interested in ${p.interests[0]}.` },
  { category: "Business", template: (a: string, b: string) => `${a} passing along a client referral to ${b}.` },
  { category: "Church", template: (a: string, b: string, p: SimPersona) => `${a} introducing ${b} from the ${p.city} community.` },
  { category: "Family", template: (a: string, b: string) => `${a} wants you to meet ${b} at the next family gathering.` },
  { category: "Mentorship", template: (a: string, b: string, p: SimPersona) => `${a} recommends ${b} for a project in ${p.region}.` },
  { category: "Business", template: (a: string, b: string) => `${a} thinks ${b} is perfect for a startup advisory chat.` },
] as const;

const DISCOVERY_TEMPLATES = [
  (p: SimPersona) => `${p.profession} in ${p.city}: looking for collaborators on ${p.interests[0]}.`,
  (p: SimPersona) => `Hosting a ${p.interests[1]} meetup in ${p.city} — who is in?`,
  (p: SimPersona) => `Sharing opportunities for ${p.interests[2]} professionals across ${p.region}.`,
  (p: SimPersona) => `Open to mentoring junior ${p.profession.toLowerCase()}s in ${p.region}.`,
  (p: SimPersona) => `Project update: partnering on ${p.interests[0]} initiatives this quarter.`,
];

function name(personas: SimPersona[], index: number): string {
  return personas[index]?.name ?? `User ${index}`;
}

function communityMember(community: SimCommunity, offset: number): number {
  const size = community.memberIndices.length;
  return community.memberIndices[((offset % size) + size) % size];
}

export function planSimulationContent(
  personas: SimPersona[],
  communities: SimCommunity[],
  targets: SimulationTargets = resolveTargets()
): {
  stories: PlannedStory[];
  discoveries: PlannedDiscovery[];
  messages: PlannedMessage[];
  notifications: PlannedNotification[];
} {
  const rng = mulberry32(99);
  const stories: PlannedStory[] = [];
  const publishedTarget = targets.taggedStories - targets.introductionRequests;
  const edgeKeys = new Set<string>();
  let publishedCount = 0;

  const edgeKey = (authorIndex: number, taggedIndex: number) => `${authorIndex}->${taggedIndex}`;

  const pushPublished = (story: Omit<PlannedStory, "status"> & { status?: "published" }) => {
    if (publishedCount >= publishedTarget) return;
    const key = edgeKey(story.authorIndex, story.taggedIndex);
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    stories.push({ ...story, status: "published" });
    publishedCount += 1;
  };

  /** Star + anchor pattern: every community member gets a non-empty mutual-tag home feed. */
  for (const community of communities) {
    const size = community.memberIndices.length;
    if (size < 2) continue;
    const hub = communityMember(community, 0);
    const anchor = communityMember(community, 1);

    for (let local = 1; local < size; local += 1) {
      const authorIndex = communityMember(community, local);
      pushPublished({
        id: randomUUID(),
        authorIndex: hub,
        taggedIndex: authorIndex,
        caption: `${name(personas, hub)} connecting ${name(personas, authorIndex)} ${SIM_MARKER}:mutual:hub-out:${community.id}:${local}`,
        categoryName: "Friend",
      });
      pushPublished({
        id: randomUUID(),
        authorIndex,
        taggedIndex: hub,
        caption: `${name(personas, authorIndex)} introduced by ${name(personas, hub)} ${SIM_MARKER}:mutual:hub-in:${community.id}:${local}`,
        categoryName: "Friend",
      });
    }

    for (let local = 0; local < size; local += 1) {
      const authorIndex = communityMember(community, local);
      if (authorIndex === anchor) continue;
      pushPublished({
        id: randomUUID(),
        authorIndex,
        taggedIndex: anchor,
        caption: `${name(personas, authorIndex)} recommends ${name(personas, anchor)} ${SIM_MARKER}:mutual:anchor:${community.id}:${local}`,
        categoryName: "Friend",
      });
    }
  }

  const bridgeUsers = personas.filter((p) => p.isBridge);
  for (const bridge of bridgeUsers) {
    for (let b = 0; b < 8; b += 1) {
      const otherCommunity = pick(rng, communities);
      const taggedIndex = communityMember(otherCommunity, 0);
      if (taggedIndex === bridge.index) continue;
      const scenario = pick(rng, STORY_SCENARIOS);
      pushPublished({
        id: randomUUID(),
        authorIndex: bridge.index,
        taggedIndex,
        caption: `${scenario.template(bridge.name, name(personas, taggedIndex), bridge)} ${SIM_MARKER}:bridge:${bridge.index}:${b}`,
        categoryName: scenario.category,
      });
    }
  }

  for (const community of communities) {
    const size = community.memberIndices.length;
    for (let local = 0; local < size && publishedCount < publishedTarget; local += 1) {
      const authorIndex = communityMember(community, local);
      const introsPerUser = Math.ceil(publishedTarget / (communities.length * size));
      for (let k = 1; k <= introsPerUser && publishedCount < publishedTarget; k += 1) {
        const taggedIndex = communityMember(community, local + k * 3 + 1);
        if (taggedIndex === authorIndex) continue;
        const scenario = pick(rng, STORY_SCENARIOS);
        const author = personas[authorIndex];
        pushPublished({
          id: randomUUID(),
          authorIndex,
          taggedIndex,
          caption: `${scenario.template(name(personas, authorIndex), name(personas, taggedIndex), author)} ${SIM_MARKER}:story:${authorIndex}-${taggedIndex}-${k}`,
          categoryName: scenario.category,
        });
      }
    }
  }

  for (let i = publishedCount; i < publishedTarget; i += 1) {
    const authorIndex = Math.floor(rng() * personas.length);
    let taggedIndex = Math.floor(rng() * personas.length);
    if (taggedIndex === authorIndex) taggedIndex = (taggedIndex + 1) % personas.length;
    const scenario = pick(rng, STORY_SCENARIOS);
    pushPublished({
      id: randomUUID(),
      authorIndex,
      taggedIndex,
      caption: `${scenario.template(name(personas, authorIndex), name(personas, taggedIndex), personas[authorIndex])} ${SIM_MARKER}:fill:${i}`,
      categoryName: scenario.category,
    });
  }

  const published = stories.slice(0, publishedTarget);
  stories.length = 0;
  stories.push(...published);

  for (let d = 0; d < targets.introductionRequests; d += 1) {
    const authorIndex = Math.floor(rng() * personas.length);
    let taggedIndex = Math.floor(rng() * personas.length);
    if (taggedIndex === authorIndex) taggedIndex = (taggedIndex + 1) % personas.length;
    stories.push({
      id: randomUUID(),
      authorIndex,
      taggedIndex,
      status: "draft",
      caption: `${name(personas, authorIndex)} requested an introduction to ${name(personas, taggedIndex)} ${SIM_MARKER}:draft:${d}`,
      categoryName: pick(rng, ["Business", "Friend", "Mentorship"] as const),
      kind: "draft_request",
    });
  }

  const discoveries: PlannedDiscovery[] = [];
  for (let i = 0; i < targets.discoveryPosts; i += 1) {
    const authorIndex = Math.floor(rng() * personas.length);
    const persona = personas[authorIndex];
    const tpl = pick(rng, DISCOVERY_TEMPLATES);
    discoveries.push({
      id: randomUUID(),
      authorIndex,
      content: `${tpl(persona)} ${SIM_MARKER}:disc:${i}`,
      categoryName: persona.interests[0] === "fintech" ? "Business" : "Friend",
    });
  }

  const messages: PlannedMessage[] = [];
  for (let i = 0; i < targets.messages; i += 1) {
    const senderIndex = Math.floor(rng() * personas.length);
    let receiverIndex = Math.floor(rng() * personas.length);
    if (receiverIndex === senderIndex) receiverIndex = (receiverIndex + 1) % personas.length;
    const origin = pick(rng, ["story", "discoveries", "direct"] as const);
    messages.push({
      id: randomUUID(),
      senderIndex,
      receiverIndex,
      origin,
      body: `Following up on our ${origin} connection — ${SIM_MARKER}:msg:${i}`,
    });
  }

  const notificationTypes = [
    "introduction_received",
    "message_received",
    "discovery_liked",
    "trust_score_increased",
    "shared_introducer_discovered",
    "discovery_commented",
  ];
  const notifications: PlannedNotification[] = [];
  for (let i = 0; i < targets.notifications; i += 1) {
    const userIndex = Math.floor(rng() * personas.length);
    let actorIndex = Math.floor(rng() * personas.length);
    if (actorIndex === userIndex) actorIndex = (actorIndex + 1) % personas.length;
    const type = pick(rng, notificationTypes);
    notifications.push({
      id: randomUUID(),
      userIndex,
      actorIndex,
      type,
      title: type.replace(/_/g, " "),
      message: `${name(personas, actorIndex)} triggered ${type} ${SIM_MARKER}:notif:${i}`,
    });
  }

  return { stories, discoveries, messages, notifications };
}

export function storyImage(seed: string): string {
  return `https://picsum.photos/seed/sim-${seed}/1080/1920`;
}

export function avatarUrl(name: string): string {
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&size=256`;
}

export type UserIdMap = Map<number, string>;

export function mediaTypeImage(): MediaType {
  return "image" as MediaType;
}
