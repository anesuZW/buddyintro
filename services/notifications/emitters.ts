import { NOTIFICATION_TYPES } from "@/lib/notification-types";
import {
  buildDiscoveryEngagementNotification,
  buildDiscoveryMessageNotification,
  buildIntroductionReceivedNotification,
  buildInviteNotification,
  buildMessageReceivedNotification,
  buildSharedIntroducerNotification,
  buildTrustScoreNotification,
  buildVerificationNotification,
  getUserLocale,
} from "@/lib/i18n/notifications";
import { notificationQueue } from "@/services/notifications/notification-service";

export async function notifyIntroductionReceived(args: {
  taggedUserId: string;
  authorId: string;
  authorName: string;
  storyId: string;
}) {
  const locale = await getUserLocale(args.taggedUserId);
  const copy = await buildIntroductionReceivedNotification(locale, args.authorName);
  await notificationQueue.enqueue({
    userId: args.taggedUserId,
    actorId: args.authorId,
    type: NOTIFICATION_TYPES.INTRODUCTION_RECEIVED,
    title: copy.title,
    message: copy.message,
    entityType: "story",
    entityId: args.storyId,
  });
}

export async function notifyMessageReceived(args: {
  receiverId: string;
  senderId: string;
  senderName: string;
  preview: string;
  storyReference?: string | null;
  discoveriesPostReference?: string | null;
}) {
  const type = args.storyReference
    ? NOTIFICATION_TYPES.STORY_REPLY
    : args.discoveriesPostReference
      ? NOTIFICATION_TYPES.DISCOVERIES_CONVERSATION
      : NOTIFICATION_TYPES.MESSAGE_RECEIVED;

  const locale = await getUserLocale(args.receiverId);
  const copy = await buildMessageReceivedNotification(locale, args.senderName, args.preview);

  await notificationQueue.enqueue({
    userId: args.receiverId,
    actorId: args.senderId,
    type,
    title: copy.title,
    message: copy.message,
    entityType: "message",
    entityId: args.storyReference ?? args.discoveriesPostReference ?? args.senderId,
  });
}

export async function notifyDiscoveryEngagement(args: {
  postAuthorId: string;
  actorId: string;
  actorName: string;
  postId: string;
  kind: "liked" | "commented" | "shared";
  preview?: string;
}) {
  const typeMap = {
    liked: NOTIFICATION_TYPES.DISCOVERY_LIKED,
    commented: NOTIFICATION_TYPES.DISCOVERY_COMMENTED,
    shared: NOTIFICATION_TYPES.DISCOVERY_SHARED,
  };

  const locale = await getUserLocale(args.postAuthorId);
  const copy = await buildDiscoveryEngagementNotification(
    locale,
    args.kind,
    args.actorName,
    args.preview
  );

  await notificationQueue.enqueue({
    userId: args.postAuthorId,
    actorId: args.actorId,
    type: typeMap[args.kind],
    title: copy.title,
    message: copy.message,
    entityType: "discoveries_post",
    entityId: args.postId,
  });
}

export async function notifyInviteAccepted(args: {
  inviterId: string;
  inviteeName: string;
  invitationId: string;
}) {
  const locale = await getUserLocale(args.inviterId);
  const copy = await buildInviteNotification(locale, "accepted", args.inviteeName);
  await notificationQueue.enqueue({
    userId: args.inviterId,
    type: NOTIFICATION_TYPES.INVITE_ACCEPTED,
    title: copy.title,
    message: copy.message,
    entityType: "invitation",
    entityId: args.invitationId,
  });
}

export async function notifyInviteOpened(args: {
  inviterId: string;
  invitationId: string;
}) {
  const locale = await getUserLocale(args.inviterId);
  const copy = await buildInviteNotification(locale, "opened");
  await notificationQueue.enqueue({
    userId: args.inviterId,
    type: NOTIFICATION_TYPES.INVITE_OPENED,
    title: copy.title,
    message: copy.message,
    entityType: "invitation",
    entityId: args.invitationId,
    skipEmail: true,
  });
}

export async function notifyInviteRegistered(args: {
  inviterId: string;
  inviteeName: string;
  invitationId: string;
}) {
  const locale = await getUserLocale(args.inviterId);
  const copy = await buildInviteNotification(locale, "registered", args.inviteeName);
  await notificationQueue.enqueue({
    userId: args.inviterId,
    type: NOTIFICATION_TYPES.INVITE_REGISTERED,
    title: copy.title,
    message: copy.message,
    entityType: "invitation",
    entityId: args.invitationId,
  });
}

export async function notifyDiscoveryMessage(args: {
  postAuthorId: string;
  actorId: string;
  actorName: string;
  postId: string;
}) {
  const locale = await getUserLocale(args.postAuthorId);
  const copy = await buildDiscoveryMessageNotification(locale, args.actorName);
  await notificationQueue.enqueue({
    userId: args.postAuthorId,
    actorId: args.actorId,
    type: NOTIFICATION_TYPES.DISCOVERY_MESSAGE,
    title: copy.title,
    message: copy.message,
    entityType: "discoveries_post",
    entityId: args.postId,
  });
}

export async function notifyTrustScoreIncreased(args: {
  userId: string;
  otherUserId: string;
  otherName: string;
  newScore: number;
  sharedCount: number;
}) {
  const locale = await getUserLocale(args.userId);
  const copy = await buildTrustScoreNotification(
    locale,
    args.otherName,
    args.newScore,
    args.sharedCount
  );
  await notificationQueue.enqueue({
    userId: args.userId,
    actorId: args.otherUserId,
    type: NOTIFICATION_TYPES.TRUST_SCORE_INCREASED,
    title: copy.title,
    message: copy.message,
    entityType: "user",
    entityId: args.otherUserId,
  });
}

export async function notifySharedIntroducerDiscovered(args: {
  userId: string;
  otherUserId: string;
  otherName: string;
  introducerName: string;
}) {
  const locale = await getUserLocale(args.userId);
  const copy = await buildSharedIntroducerNotification(
    locale,
    args.otherName,
    args.introducerName
  );
  await notificationQueue.enqueue({
    userId: args.userId,
    actorId: args.otherUserId,
    type: NOTIFICATION_TYPES.SHARED_INTRODUCER_DISCOVERED,
    title: copy.title,
    message: copy.message,
    entityType: "user",
    entityId: args.otherUserId,
  });
}

export async function notifyVerification(args: {
  userId: string;
  kind: "phone" | "identity" | "approved" | "rejected";
}) {
  const locale = await getUserLocale(args.userId);
  const copy = await buildVerificationNotification(locale, args.kind);
  const typeMap = {
    phone: NOTIFICATION_TYPES.PHONE_VERIFIED,
    identity: NOTIFICATION_TYPES.IDENTITY_VERIFIED,
    approved: NOTIFICATION_TYPES.VERIFICATION_APPROVED,
    rejected: NOTIFICATION_TYPES.VERIFICATION_REJECTED,
  };

  await notificationQueue.enqueue({
    userId: args.userId,
    type: typeMap[args.kind],
    title: copy.title,
    message: copy.message,
    entityType: "user",
    entityId: args.userId,
  });
}
