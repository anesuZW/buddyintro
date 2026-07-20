/**
 * @deprecated Use push-service.ts — kept for backward-compatible imports.
 */
export {
  sendPushToUser as sendWebPushToUser,
  enqueuePushNotification,
  getVapidPublicKey,
} from "@/services/notifications/push-service";
