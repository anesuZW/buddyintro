/** Notification type constants — extensible without migrations. */

export const NOTIFICATION_TYPES = {
  INTRODUCTION_RECEIVED: "introduction_received",
  INTRODUCTION_MUTUAL: "introduction_mutual_connection",
  INTRODUCTION_REPLY: "introduction_reply",
  INTRODUCTION_COMMENT: "introduction_comment",
  INTRODUCTION_LIKED: "introduction_liked",
  INTRODUCTION_VIEWED: "introduction_viewed",
  INVITE_SENT: "invite_sent",
  INVITE_OPENED: "invite_opened",
  INVITE_ACCEPTED: "invite_accepted",
  INVITE_REGISTERED: "invite_registered",
  DISCOVERY_LIKED: "discovery_liked",
  DISCOVERY_COMMENTED: "discovery_commented",
  DISCOVERY_SHARED: "discovery_shared",
  DISCOVERY_MESSAGE: "discovery_message",
  DISCOVERY_TRUSTED_POST: "discovery_trusted_post",
  MESSAGE_RECEIVED: "message_received",
  STORY_REPLY: "story_reply",
  DISCOVERIES_CONVERSATION: "discoveries_conversation",
  MESSAGE_MENTION: "message_mention",
  SHARED_INTRODUCER_DISCOVERED: "shared_introducer_discovered",
  TRUST_SCORE_INCREASED: "trust_score_increased",
  MUTUAL_CONNECTION_FOUND: "mutual_connection_found",
  PHONE_VERIFIED: "phone_verified",
  IDENTITY_VERIFIED: "identity_verified",
  VERIFICATION_APPROVED: "verification_approved",
  VERIFICATION_REJECTED: "verification_rejected",
  ADMIN_ANNOUNCEMENT: "admin_announcement",
  ADMIN_MAINTENANCE: "admin_maintenance",
  ADMIN_POLICY_UPDATE: "admin_policy_update",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_PRIORITY: Record<string, number> = {
  [NOTIFICATION_TYPES.INTRODUCTION_RECEIVED]: 1,
  [NOTIFICATION_TYPES.SHARED_INTRODUCER_DISCOVERED]: 2,
  [NOTIFICATION_TYPES.TRUST_SCORE_INCREASED]: 3,
  [NOTIFICATION_TYPES.INVITE_ACCEPTED]: 4,
  [NOTIFICATION_TYPES.INVITE_REGISTERED]: 4,
  [NOTIFICATION_TYPES.MESSAGE_RECEIVED]: 5,
  [NOTIFICATION_TYPES.STORY_REPLY]: 5,
  [NOTIFICATION_TYPES.DISCOVERIES_CONVERSATION]: 5,
  [NOTIFICATION_TYPES.INTRODUCTION_MUTUAL]: 6,
  [NOTIFICATION_TYPES.MUTUAL_CONNECTION_FOUND]: 6,
  [NOTIFICATION_TYPES.DISCOVERY_TRUSTED_POST]: 7,
  [NOTIFICATION_TYPES.DISCOVERY_LIKED]: 20,
  [NOTIFICATION_TYPES.DISCOVERY_COMMENTED]: 20,
  [NOTIFICATION_TYPES.DISCOVERY_SHARED]: 20,
  [NOTIFICATION_TYPES.INTRODUCTION_LIKED]: 25,
  [NOTIFICATION_TYPES.INTRODUCTION_VIEWED]: 30,
};

const CATEGORY_PREF_MAP = {
  introduction: "enableIntroductionNotifications",
  invitation: "enableInvitationNotifications",
  discovery: "enableDiscoveryNotifications",
  message: "enableMessageNotifications",
  trust: "enableTrustNotifications",
  verification: "enableVerificationNotifications",
  announcement: "enableNotifications",
} as const;

export type NotificationCategory = keyof typeof CATEGORY_PREF_MAP;

export const NOTIFICATION_CATEGORIES: Record<string, NotificationCategory> = {
  [NOTIFICATION_TYPES.INTRODUCTION_RECEIVED]: "introduction",
  [NOTIFICATION_TYPES.INTRODUCTION_MUTUAL]: "introduction",
  [NOTIFICATION_TYPES.INTRODUCTION_REPLY]: "introduction",
  [NOTIFICATION_TYPES.INTRODUCTION_COMMENT]: "introduction",
  [NOTIFICATION_TYPES.INTRODUCTION_LIKED]: "introduction",
  [NOTIFICATION_TYPES.INTRODUCTION_VIEWED]: "introduction",
  [NOTIFICATION_TYPES.INVITE_SENT]: "invitation",
  [NOTIFICATION_TYPES.INVITE_OPENED]: "invitation",
  [NOTIFICATION_TYPES.INVITE_ACCEPTED]: "invitation",
  [NOTIFICATION_TYPES.INVITE_REGISTERED]: "invitation",
  [NOTIFICATION_TYPES.DISCOVERY_LIKED]: "discovery",
  [NOTIFICATION_TYPES.DISCOVERY_COMMENTED]: "discovery",
  [NOTIFICATION_TYPES.DISCOVERY_SHARED]: "discovery",
  [NOTIFICATION_TYPES.DISCOVERY_MESSAGE]: "discovery",
  [NOTIFICATION_TYPES.DISCOVERY_TRUSTED_POST]: "discovery",
  [NOTIFICATION_TYPES.MESSAGE_RECEIVED]: "message",
  [NOTIFICATION_TYPES.STORY_REPLY]: "message",
  [NOTIFICATION_TYPES.DISCOVERIES_CONVERSATION]: "message",
  [NOTIFICATION_TYPES.MESSAGE_MENTION]: "message",
  [NOTIFICATION_TYPES.SHARED_INTRODUCER_DISCOVERED]: "trust",
  [NOTIFICATION_TYPES.TRUST_SCORE_INCREASED]: "trust",
  [NOTIFICATION_TYPES.MUTUAL_CONNECTION_FOUND]: "trust",
  [NOTIFICATION_TYPES.PHONE_VERIFIED]: "verification",
  [NOTIFICATION_TYPES.IDENTITY_VERIFIED]: "verification",
  [NOTIFICATION_TYPES.VERIFICATION_APPROVED]: "verification",
  [NOTIFICATION_TYPES.VERIFICATION_REJECTED]: "verification",
  [NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT]: "announcement",
  [NOTIFICATION_TYPES.ADMIN_MAINTENANCE]: "announcement",
  [NOTIFICATION_TYPES.ADMIN_POLICY_UPDATE]: "announcement",
};

export function getCategoryPrefField(type: string): string | null {
  const cat = NOTIFICATION_CATEGORIES[type];
  if (!cat) return null;
  return CATEGORY_PREF_MAP[cat];
}

const ADMIN_CATEGORY_MAP: Record<NotificationCategory, keyof typeof ADMIN_CATEGORY_FIELDS> = {
  introduction: "enableIntroductionNotifications",
  invitation: "enableIntroductionNotifications",
  discovery: "enableDiscoveryNotifications",
  message: "enableMessageNotifications",
  trust: "enableTrustNotifications",
  verification: "enableVerificationNotifications",
  announcement: "enableAnnouncementNotifications",
};

const ADMIN_CATEGORY_FIELDS = {
  enableIntroductionNotifications: true,
  enableDiscoveryNotifications: true,
  enableMessageNotifications: true,
  enableTrustNotifications: true,
  enableVerificationNotifications: true,
  enableAnnouncementNotifications: true,
} as const;

export function getAdminCategoryField(type: string): string | null {
  const cat = NOTIFICATION_CATEGORIES[type];
  if (!cat) return null;
  return ADMIN_CATEGORY_MAP[cat];
}

export function notificationHref(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  actorId?: string | null
): string {
  if (!entityType || !entityId) {
    if (actorId) return `/messages/${actorId}`;
    return "/notifications";
  }
  switch (entityType) {
    case "story":
      return `/introductions/${entityId}`;
    case "discoveries_post":
      return `/discoveries?post=${entityId}`;
    case "message":
      return actorId ? `/messages/${actorId}` : "/messages";
    case "user":
      return `/profile/${entityId}`;
    case "invitation":
      return `/invite/${entityId}`;
    default:
      return "/notifications";
  }
}
