import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sendMessage, ensureConversationContext, getConversationList } from "@/services/messages";
import { meetsInviteGate } from "@/services/invites";
import { getAdminSettings } from "@/services/admin";
import { checkMessagingAllowed } from "@/lib/verification-gates";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { clampLimit } from "@/lib/pagination";

const Schema = z.object({
  receiverId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  storyReference: z.string().uuid().nullable().optional(),
  discoveriesPostReference: z.string().uuid().nullable().optional(),
  conversationOrigin: z.enum(["story", "discoveries", "direct"]).optional(),
});

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = clampLimit(Number(searchParams.get("limit") ?? undefined));

  const result = await getConversationList(user.id, { cursor, limit });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const me = await requireUser();

  const limited = enforceRateLimit(me.id, "messages:post");
  if (limited) return limited;

  const data = Schema.parse(await request.json());

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
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: gate.status });
  }

  const origin =
    data.conversationOrigin ??
    (data.storyReference ? "story" : data.discoveriesPostReference ? "discoveries" : "direct");

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
}
