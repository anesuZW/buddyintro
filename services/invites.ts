import "server-only";

import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import type { InviteMethod, Prisma } from "@prisma/client";
import { appUrl } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone";
import { sendEmail } from "@/services/email";
import {
  buildGenericInvitationEmail,
  buildInvitationStoryEmail,
} from "@/services/email-templates/invitation-story";
import { invitePreviewUrl, inviteSignupUrl } from "@/lib/invite-preview";
import { BRAND } from "@/lib/branding";
import { buildInviteShareLinks } from "@/lib/invite-share";
import type { PhoneInviteShare } from "@/types";
import { scheduleTrustGraphRefresh } from "@/services/trust-graph-jobs";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { notifyInviteAccepted, notifyInviteOpened, notifyInviteRegistered } from "@/services/notifications/emitters";

const tokenAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const generateToken = customAlphabet(tokenAlphabet, 24);

const DEFAULT_INVITE_DAYS = 7;

export type InvitationStoryPreview = {
  mediaUrl: string;
  mediaType: "image" | "video";
  text?: string | null;
  inviterName: string;
  inviterAvatar?: string | null;
};

export type CreateInvitationArgs =
  | { kind: "email"; email: string; invitedById: string; expiresAt?: Date }
  | { kind: "phone"; phone: string; invitedById: string; expiresAt?: Date };

export async function createInvitation(
  args: CreateInvitationArgs,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const expiresAt =
    args.expiresAt ??
    new Date(Date.now() + DEFAULT_INVITE_DAYS * 24 * 60 * 60 * 1000);

  if (args.kind === "email") {
    const email = args.email.toLowerCase().trim();
    const existing = await tx.invitation.findFirst({
      where: { email, invitedById: args.invitedById, registered: false },
    });
    if (existing) return existing;

    const inviteToken = generateToken();
    return tx.invitation.create({
      data: {
        email,
        invitedById: args.invitedById,
        inviteToken,
        expiresAt,
        inviteMethod: "email",
      },
    });
  }

  const phoneNumber = normalizePhone(args.phone);
  if (!phoneNumber) throw new Error("Invalid phone number. Use international format e.g. +263774123456");

  const existing = await tx.invitation.findFirst({
    where: { phoneNumber, invitedById: args.invitedById, registered: false },
  });
  if (existing) return existing;

  const inviteToken = generateToken();
  return tx.invitation.create({
    data: {
      phoneNumber,
      invitedById: args.invitedById,
      inviteToken,
      expiresAt,
      inviteMethod: "email",
    },
  });
}

export function inviteLink(token: string) {
  return appUrl(`/invite/${token}`);
}

export function toPhoneInviteShare(
  invitation: { inviteToken: string; phoneNumber: string | null }
): PhoneInviteShare | null {
  if (!invitation.phoneNumber) return null;
  const links = buildInviteShareLinks({
    token: invitation.inviteToken,
    phoneNumber: invitation.phoneNumber,
  });
  return {
    inviteToken: invitation.inviteToken,
    phoneNumber: invitation.phoneNumber,
    ...links,
  };
}

export async function sendInvitationEmail(args: {
  invitation: { email: string | null; inviteToken: string };
  inviterName: string;
  inviterAvatar?: string | null;
  story?: InvitationStoryPreview;
}) {
  if (!args.invitation.email) return { ok: false as const, reason: "no_email" as const };

  const previewUrl = invitePreviewUrl(args.invitation.inviteToken);
  const signupUrl = inviteSignupUrl(args.invitation.inviteToken);

  const built = args.story
    ? buildInvitationStoryEmail({
        recipientEmail: args.invitation.email,
        inviterName: args.inviterName,
        inviterAvatarUrl: args.inviterAvatar ?? args.story.inviterAvatar,
        storyCaption: args.story.text,
        previewText: `${args.inviterName} tagged you in a ${BRAND.name} story. Preview it before you join.`,
        mediaUrl: args.story.mediaUrl,
        mediaType: args.story.mediaType,
        previewUrl,
        signupUrl,
      })
    : buildGenericInvitationEmail({
        recipientEmail: args.invitation.email,
        inviterName: args.inviterName,
        inviteUrl: signupUrl,
        previewUrl,
      });

  return sendEmail({
    to: args.invitation.email,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });
}

export async function recordInvitationOpened(token: string) {
  const invitation = await prisma.invitation.findUnique({ where: { inviteToken: token } });
  if (!invitation || invitation.invitationOpenedAt) return invitation;
  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { invitationOpenedAt: new Date() },
  });
  void analyticsService.track({
    eventType: ANALYTICS_EVENTS.INVITE_OPENED,
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { invitedById: invitation.invitedById },
  });
  void notifyInviteOpened({
    inviterId: invitation.invitedById,
    invitationId: invitation.id,
  }).catch((err) => console.error("[invites] notify opened failed", err));
  return updated;
}

export async function setInvitationShareMethod(token: string, method: InviteMethod) {
  return prisma.invitation.updateMany({
    where: { inviteToken: token },
    data: { inviteMethod: method },
  });
}

export async function acceptInvitation(args: {
  token: string;
  userId: string;
  userEmail?: string;
}) {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteToken: args.token },
    include: { storyTags: { select: { storyId: true } } },
  });
  if (!invitation) return { ok: false as const, reason: "not_found" as const };
  if (invitation.expiresAt < new Date()) {
    return { ok: false as const, reason: "expired" as const };
  }
  if (invitation.registered) {
    return {
      ok: true as const,
      invitation,
      storyId: invitation.storyTags[0]?.storyId ?? null,
      authorId: invitation.invitedById,
    };
  }

  if (invitation.email) {
    const user =
      args.userEmail != null
        ? { email: args.userEmail }
        : await prisma.user.findUnique({
            where: { id: args.userId },
            select: { email: true },
          });

    if (!user?.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return { ok: false as const, reason: "email_mismatch" as const };
    }
  }

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      registered: true,
      registeredUserId: args.userId,
      acceptedAt: new Date(),
    },
  });

  void scheduleTrustGraphRefresh([invitation.invitedById, args.userId]).catch((err) =>
    console.error("[invites] user_connections refresh failed", err)
  );

  void analyticsService.track({
    userId: args.userId,
    eventType: ANALYTICS_EVENTS.INVITE_ACCEPTED,
    entityType: "invitation",
    entityId: invitation.id,
  });

  void analyticsService.track({
    userId: args.userId,
    eventType: ANALYTICS_EVENTS.INVITE_REGISTERED,
    entityType: "invitation",
    entityId: invitation.id,
  });

  const invitee = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { name: true },
  });
  void notifyInviteAccepted({
    inviterId: invitation.invitedById,
    inviteeName: invitee?.name ?? "Someone",
    invitationId: invitation.id,
  }).catch((err) => console.error("[invites] notify failed", err));

  void notifyInviteRegistered({
    inviterId: invitation.invitedById,
    inviteeName: invitee?.name ?? "Someone",
    invitationId: invitation.id,
  }).catch((err) => console.error("[invites] notify registered failed", err));

  return {
    ok: true as const,
    invitation: updated,
    storyId: invitation.storyTags[0]?.storyId ?? null,
    authorId: invitation.invitedById,
  };
}

export async function getInvitationForOnboarding(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteToken: token },
    include: {
      invitedBy: { select: { id: true, name: true, profilePicture: true } },
      storyTags: {
        include: {
          story: {
            select: {
              id: true,
              mediaUrl: true,
              mediaType: true,
              text: true,
              status: true,
              expiresAt: true,
            },
          },
        },
      },
    },
  });

  if (!invitation) return null;
  if (invitation.registered) return { ...invitation, state: "registered" as const };
  if (invitation.expiresAt < new Date()) return { ...invitation, state: "expired" as const };

  const story = invitation.storyTags[0]?.story ?? null;
  return { ...invitation, state: "pending" as const, story };
}

export async function meetsInviteGate(userId: string, required: number) {
  if (required <= 0) return true;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { invitesRegistered: true },
  });
  return (u?.invitesRegistered ?? 0) >= required;
}
