import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createInvitation,
  inviteLink,
  sendInvitationEmail,
  toPhoneInviteShare,
} from "@/services/invites";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { clampLimit } from "@/lib/pagination";

const Schema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
}).refine((d) => d.email || d.phone, { message: "Provide email or phone" });

export async function GET(request: Request) {
  const me = await requireUser();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = clampLimit(Number(searchParams.get("limit") ?? undefined));

  const invites = await prisma.invitation.findMany({
    where: {
      invitedById: me.id,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = invites.length > limit;
  const slice = hasMore ? invites.slice(0, limit) : invites;

  return NextResponse.json({
    invites: slice,
    nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
  });
}

export async function POST(request: Request) {
  const me = await requireUser();

  const limited = await enforceRateLimit(me.id, "invites:post");
  if (limited) return limited;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    if (parsed.data.email) {
      const invitation = await createInvitation({
        kind: "email",
        email: parsed.data.email,
        invitedById: me.id,
      });
      try {
        await sendInvitationEmail({
          invitation,
          inviterName: me.name,
          inviterAvatar: me.profilePicture,
        });
      } catch (error) {
        console.error("[api/invites] email failed", error);
      }
      void analyticsService.track({
        userId: me.id,
        eventType: ANALYTICS_EVENTS.INVITE_SENT,
        entityType: "invitation",
        entityId: invitation.id,
      });
      return NextResponse.json({
        invitation,
        link: inviteLink(invitation.inviteToken),
      });
    }

    const phone = normalizePhone(parsed.data.phone!);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const invitation = await createInvitation({
      kind: "phone",
      phone,
      invitedById: me.id,
    });

    void analyticsService.track({
      userId: me.id,
      eventType: ANALYTICS_EVENTS.INVITE_SENT,
      entityType: "invitation",
      entityId: invitation.id,
    });

    return NextResponse.json({
      invitation,
      link: inviteLink(invitation.inviteToken),
      share: toPhoneInviteShare(invitation),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not create invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
