import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { pushSubscriptionService } from "@/services/notifications/push-subscription-service";

export async function POST(request: Request) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await pushSubscriptionService.remove(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
