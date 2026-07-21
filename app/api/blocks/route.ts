import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { blockUser, listBlockedUserIds } from "@/services/moderation";

const Schema = z.object({
  userId: z.string().uuid(),
});

export async function GET() {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const blockedIds = await listBlockedUserIds(user.id);
  return NextResponse.json({ blockedIds });
}

export async function POST(request: Request) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const body = Schema.parse(await request.json());
  try {
    await blockUser(user.id, body.userId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not block user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
