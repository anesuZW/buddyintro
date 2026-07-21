import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { notificationService } from "@/services/notifications/notification-service";

const PreferencesSchema = z.object({
  enableNotifications: z.boolean().optional(),
  enableIntroductionNotifications: z.boolean().optional(),
  enableInvitationNotifications: z.boolean().optional(),
  enableDiscoveryNotifications: z.boolean().optional(),
  enableMessageNotifications: z.boolean().optional(),
  enableTrustNotifications: z.boolean().optional(),
  enableVerificationNotifications: z.boolean().optional(),
  enableEmailNotifications: z.boolean().optional(),
  enablePushNotifications: z.boolean().optional(),
  enableInAppNotifications: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
});

export async function GET() {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const preferences = await notificationService.getPreferences(user.id);
  return NextResponse.json({ preferences });
}

export async function PATCH(request: Request) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const body = PreferencesSchema.parse(await request.json());
  const preferences = await notificationService.updatePreferences(user.id, body);
  return NextResponse.json({ preferences });
}
