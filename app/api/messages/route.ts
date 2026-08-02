import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { sendMessage, ensureConversationContext, getConversationList } from "@/services/messages";
import { meetsInviteGate } from "@/services/invites";
import { getAdminSettings } from "@/services/admin";
import { checkMessagingAllowed } from "@/lib/verification-gates";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { clampLimit } from "@/lib/pagination";
import { apiJson, withApiHandler } from "@/lib/api-error";

const Schema = z.object({
  receiverId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  storyReference: z.string().uuid().nullable().optional(),
  discoveriesPostReference: z.string().uuid().nullable().optional(),
  conversationOrigin: z.enum(["story", "discoveries", "direct"]).optional(),
});

export const GET = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = clampLimit(Number(searchParams.get("limit") ?? undefined));

  const result = await getConversationList(user.id, { cursor, limit });
  return NextResponse.json(result);
});

export const POST = withApiHandler(async (request: Request) => {
  const meAuth = await requireUserApi();
  if (isApiAuthError(meAuth)) return meAuth;
  const me = meAuth;

  const limited = await enforceRateLimit(me.id, "messages:post");
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiJson(422, { error: "Invalid JSON body", code: "invalid_json" });
  }

  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return apiJson(422, {
      error: parsed.error.issues[0]?.message || "Invalid input",
      code: "validation_error",
    });
  }
  const data = parsed.data;

  const settings = await getAdminSettings();
  if (settings.inviteGateEnabled) {
    const ok = await meetsInviteGate(me.id, settings.requiredInvites);
    if (!ok) {
      return NextResponse.json(
        { error: `Invite at least ${settings.requiredInvites} friends first.` },
        { status: 403 }
      );
    }
  }

  const gate = await checkMessagingAllowed(me.id, data.receiverId, me);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, code: gate.code },
      { status: gate.status }
    );
  }

  const origin =
    data.conversationOrigin ??
    (data.storyReference
      ? "story"
      : data.discoveriesPostReference
        ? "discoveries"
        : "direct");

  if (origin !== "direct") {
    await ensureConversationContext({
      userId: me.id,
      otherUserId: data.receiverId,
      origin,
      storyReference: data.storyReference ?? null,
      discoveriesPostReference: data.discoveriesPostReference ?? null,
    });
  }

  const message = await sendMessage({
    senderId: me.id,
    receiverId: data.receiverId,
    message: data.message,
    storyReference: data.storyReference ?? null,
    discoveriesPostReference: data.discoveriesPostReference ?? null,
    conversationOrigin: origin === "direct" ? null : origin,
  });
  return NextResponse.json({ message });
});
