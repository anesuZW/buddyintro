import { NOTIFICATION_TYPES } from "@/lib/notification-types";
import { BRAND } from "@/lib/branding";
import { notificationQueue } from "@/services/notifications/notification-service";

export async function notifyIntroductionReceived(args: {
  taggedUserId: string;
  authorId: string;
  authorName: string;
  storyId: string;
}) {
  await notificationQueue.enqueue({
    userId: args.taggedUserId,
    actorId: args.authorId,
    type: NOTIFICATION_TYPES.INTRODUCTION_RECEIVED,
    title: "New introduction",
    message: `${args.authorName} introduced you on ${BRAND.name}.`,
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

  await notificationQueue.enqueue({
    userId: args.receiverId,
    actorId: args.senderId,
    type,
    title: "New message",
    message: `${args.senderName}: ${args.preview.slice(0, 120)}`,
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
  const titleMap = {
    liked: "Discovery liked",
    commented: "New comment",
    shared: "Discovery shared",
  };
  await notificationQueue.enqueue({
    userId: args.postAuthorId,
    actorId: args.actorId,
    type: typeMap[args.kind],
    title: titleMap[args.kind],
    message:
      args.kind === "commented" && args.preview
        ? `${args.actorName} commented: ${args.preview.slice(0, 100)}`
        : `${args.actorName} ${args.kind} your discovery.`,
    entityType: "discoveries_post",
    entityId: args.postId,
  });
}

export async function notifyInviteAccepted(args: {
  inviterId: string;
  inviteeName: string;
  invitationId: string;
}) {
  await notificationQueue.enqueue({
    userId: args.inviterId,
    type: NOTIFICATION_TYPES.INVITE_ACCEPTED,
    title: "Invitation accepted",
    message: `${args.inviteeName} accepted your invitation.`,
    entityType: "invitation",
    entityId: args.invitationId,
  });
}

export async function notifyInviteOpened(args: {
  inviterId: string;
  invitationId: string;
}) {
  await notificationQueue.enqueue({
    userId: args.inviterId,
    type: NOTIFICATION_TYPES.INVITE_OPENED,
    title: "Invitation opened",
    message: "Someone opened your invitation link.",
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
  await notificationQueue.enqueue({
    userId: args.inviterId,
    type: NOTIFICATION_TYPES.INVITE_REGISTERED,
    title: "Invitee registered",
    message: `${args.inviteeName} completed registration via your invitation.`,
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
  await notificationQueue.enqueue({
    userId: args.postAuthorId,
    actorId: args.actorId,
    type: NOTIFICATION_TYPES.DISCOVERY_MESSAGE,
    title: "Message from discovery",
    message: `${args.actorName} messaged you from your discovery.`,
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
  await notificationQueue.enqueue({
    userId: args.userId,
    actorId: args.otherUserId,
    type: NOTIFICATION_TYPES.TRUST_SCORE_INCREASED,
    title: "Trust score increased",
    message: `Your trust connection with ${args.otherName} is now ${args.newScore} (${args.sharedCount} shared introducers).`,
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
  await notificationQueue.enqueue({
    userId: args.userId,
    actorId: args.otherUserId,
    type: NOTIFICATION_TYPES.SHARED_INTRODUCER_DISCOVERED,
    title: "New shared introducer",
    message: `You and ${args.otherName} now share ${args.introducerName} as an introducer.`,
    entityType: "user",
    entityId: args.otherUserId,
  });
}

export async function notifyVerification(args: {
  userId: string;
  kind: "phone" | "identity" | "approved" | "rejected";
}) {
  const map = {
    phone: { type: NOTIFICATION_TYPES.PHONE_VERIFIED, title: "Phone verified", message: "Your phone number is verified." },
    identity: { type: NOTIFICATION_TYPES.IDENTITY_VERIFIED, title: "Identity verified", message: "Your identity is verified." },
    approved: { type: NOTIFICATION_TYPES.VERIFICATION_APPROVED, title: "Verification approved", message: "Your verification was approved." },
    rejected: { type: NOTIFICATION_TYPES.VERIFICATION_REJECTED, title: "Verification rejected", message: "Your verification was rejected. Please try again." },
  };
  const m = map[args.kind];
  await notificationQueue.enqueue({
    userId: args.userId,
    type: m.type,
    title: m.title,
    message: m.message,
    entityType: "user",
    entityId: args.userId,
  });
}
