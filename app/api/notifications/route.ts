import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { notificationService } from "@/services/notifications/notification-service";
import { apiJson, withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;
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
});

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read"), id: z.string().uuid() }),
  z.object({ action: z.literal("mark_all_read") }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

export const PATCH = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiJson(422, { error: "Invalid JSON body", code: "invalid_json" });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return apiJson(422, {
      error: "Invalid input",
      code: "validation_error",
    });
  }
  const body = parsed.data;

  if (body.action === "mark_read") {
    await notificationService.markRead(user.id, body.id);
  } else if (body.action === "mark_all_read") {
    await notificationService.markAllRead(user.id);
  } else {
    await notificationService.delete(user.id, body.id);
  }

  const unreadCount = await notificationService.unreadCount(user.id);
  return NextResponse.json({ ok: true, unreadCount });
});
