/** Pluggable queue — swap for Redis/Kafka/RabbitMQ without changing callers. */
export interface NotificationQueue {
  enqueue(payload: CreateNotificationInput): Promise<void>;
}

export type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  skipEmail?: boolean;
  skipPush?: boolean;
};

export type NotificationListResult = {
  items: Array<{
    id: string;
    userId: string;
    actorId: string | null;
    type: string;
    title: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
    actor: { id: string; name: string; profilePicture: string | null } | null;
    href: string;
    priority: number;
  }>;
  nextCursor: string | null;
  unreadCount: number;
};

export type UpdateNotificationPreferencesInput = Partial<{
  enableNotifications: boolean;
  enableIntroductionNotifications: boolean;
  enableInvitationNotifications: boolean;
  enableDiscoveryNotifications: boolean;
  enableMessageNotifications: boolean;
  enableTrustNotifications: boolean;
  enableVerificationNotifications: boolean;
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  enableInAppNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}>;
