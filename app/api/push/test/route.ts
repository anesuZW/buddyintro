import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sendTestPush } from "@/services/notifications/push-service";

export async function POST() {
  const user = await requireUser();
  await sendTestPush(user.id);
  return NextResponse.json({ ok: true });
}
