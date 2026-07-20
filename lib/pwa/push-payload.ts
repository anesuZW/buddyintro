import { NOTIFICATION_TYPES, notificationHref } from "@/lib/notification-types";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  type?: string;
  icon?: string;
  badge?: string;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, unknown>;
};

const MAX_PAYLOAD_BYTES = 3800;

export function buildPushPayload(input: {
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
}): PushPayload {
  const url = notificationHref(input.entityType, input.entityId, input.actorId);
  const base: PushPayload = {
    title: input.title.slice(0, 120),
    body: input.message.slice(0, 240),
    url,
    tag: input.type,
    type: input.type,
    data: { url, type: input.type },
  };

  switch (input.type) {
    case NOTIFICATION_TYPES.MESSAGE_RECEIVED:
    case NOTIFICATION_TYPES.STORY_REPLY:
      return {
        ...base,
        actions: [
          { action: "view", title: "Reply" },
          { action: "dismiss", title: "Dismiss" },
        ],
        data: { ...base.data, replyUrl: url },
      };
    case NOTIFICATION_TYPES.INTRODUCTION_RECEIVED:
    case NOTIFICATION_TYPES.INTRODUCTION_MUTUAL:
      return {
        ...base,
        actions: [
          { action: "view-story", title: "View Story" },
          { action: "dismiss", title: "Dismiss" },
        ],
        data: { ...base.data, storyUrl: url },
      };
    case NOTIFICATION_TYPES.INVITE_ACCEPTED:
    case NOTIFICATION_TYPES.INVITE_REGISTERED:
      return {
        ...base,
        actions: [
          { action: "accept", title: "View" },
          { action: "dismiss", title: "Dismiss" },
        ],
        data: { ...base.data, acceptUrl: url },
      };
    case NOTIFICATION_TYPES.DISCOVERY_LIKED:
    case NOTIFICATION_TYPES.DISCOVERY_COMMENTED:
      return {
        ...base,
        actions: [
          { action: "discoveries", title: "Open Discoveries" },
          { action: "dismiss", title: "Dismiss" },
        ],
        data: { ...base.data, discoveriesUrl: "/discoveries" },
      };
    case NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT:
    case NOTIFICATION_TYPES.ADMIN_MAINTENANCE:
      return {
        ...base,
        actions: [{ action: "view", title: "View" }],
      };
    default:
      return base;
  }
}

export function sanitizePushPayload(payload: PushPayload): PushPayload {
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, "utf8") <= MAX_PAYLOAD_BYTES) return payload;
  return {
    ...payload,
    body: payload.body.slice(0, 180),
    data: { url: payload.url, type: payload.type },
    actions: payload.actions?.slice(0, 1),
  };
}

export function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return false;
    return url.hostname.length > 3;
  } catch {
    return false;
  }
}
