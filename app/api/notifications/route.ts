import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { notificationService } from "@/services/notifications/notification-service";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const result = await notificationService.list({
    userId: user.id,
    cursor,
    type,
    unreadOnly,
  });
  return NextResponse.json(result);
}

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read"), id: z.string().uuid() }),
  z.object({ action: z.literal("mark_all_read") }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

export async function PATCH(request: Request) {
  const user = await requireUser();
  const body = PatchSchema.parse(await request.json());

  if (body.action === "mark_read") {
    await notificationService.markRead(user.id, body.id);
  } else if (body.action === "mark_all_read") {
    await notificationService.markAllRead(user.id);
  } else {
    await notificationService.delete(user.id, body.id);
  }

  const unreadCount = await notificationService.unreadCount(user.id);
  return NextResponse.json({ ok: true, unreadCount });
}
