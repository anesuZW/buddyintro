import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { PushSendSchema } from "@/lib/pwa/push-schemas";
import { sendPushToUser } from "@/services/notifications/push-service";

export async function POST(request: Request) {
  await requireAdmin();
  const body = PushSendSchema.parse(await request.json());
  await sendPushToUser(body.userId, {
    title: body.title,
    body: body.body,
    url: body.url ?? "/notifications",
    tag: body.type ?? "admin_send",
    type: body.type,
  });
  return NextResponse.json({ ok: true });
}
