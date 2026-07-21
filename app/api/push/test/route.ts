import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { sendTestPush } from "@/services/notifications/push-service";

export async function POST() {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  await sendTestPush(user.id);
  return NextResponse.json({ ok: true });
}
