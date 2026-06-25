import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { BRAND_SUPPORT_EMAIL } from "@/lib/branding";
import { getAdminSettings } from "@/services/admin";

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || `mailto:${BRAND_SUPPORT_EMAIL}`;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendWebPushToUser(
  userId: string,
  payload: { title: string; body: string; url: string }
) {
  const settings = await getAdminSettings();
  if (!settings.enablePushNotifications) return;

  if (!configureVapid()) {
    console.warn("[push] VAPID keys not configured");
    return;
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
        }
        console.error("[push] send failed", err);
      }
    })
  );
}
