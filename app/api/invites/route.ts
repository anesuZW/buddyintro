import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
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
import { apiJson, withApiHandler } from "@/lib/api-error";

const Schema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
}).refine((d) => d.email || d.phone, { message: "Provide email or phone" });

export const GET = withApiHandler(async (request: Request) => {
  const meAuth = await requireUserApi();
  if (isApiAuthError(meAuth)) return meAuth;
  const me = meAuth;
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
});

export const POST = withApiHandler(async (request: Request) => {
  const meAuth = await requireUserApi();
  if (isApiAuthError(meAuth)) return meAuth;
  const me = meAuth;

  const limited = await enforceRateLimit(me.id, "invites:post");
  if (limited) return limited;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiJson(422, {
      error: "Validation failed",
      code: "validation_error",
      reason: "Provide a valid email or phone number.",
    });
  }

  try {
    if (parsed.data.email) {
      const invitation = await createInvitation({
        kind: "email",
        email: parsed.data.email,
        invitedById: me.id,
      });
      const sendResult = await sendInvitationEmail({
          invitation,
          inviterName: me.name,
          inviterAvatar: me.profilePicture,
        });
      if (!sendResult.ok) {
        return NextResponse.json(
          {
            error: sendResult.error,
            statusCode: sendResult.statusCode,
            providerError: sendResult.providerError,
            emailDelivery: [
              {
                email: parsed.data.email,
                ok: false,
                error: sendResult.error,
                statusCode: sendResult.statusCode,
                providerError: sendResult.providerError,
              },
            ],
          },
          { status: 502 }
        );
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
    return apiJson(400, {
      error: "Could not create invite",
      code: "invite_failed",
      reason: message,
    });
  }
});
