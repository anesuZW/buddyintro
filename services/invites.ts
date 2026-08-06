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
import {
  notifyInviteAccepted,
  notifyInviteOpened,
  notifyInviteRegistered,
} from "@/services/notifications/emitters";
import {
  buildWelcomeCardDisplay,
  type WelcomeCardDisplay,
} from "@/lib/multi-invite-welcome";

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

/**
 * Create (or reuse) a pending invitation for story tagging / manual invites.
 *
 * Reuse is allowed ONLY when the pending invite has no StoryTag yet — this
 * preserves StoryTag.invitationId @unique while allowing many invitations to
 * the same contact (each introduction story gets its own invitation).
 */
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
      where: {
        email,
        invitedById: args.invitedById,
        registered: false,
        storyTags: { none: {} },
      },
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
  if (!phoneNumber) {
    throw new Error(
      "Invalid phone number. Use international format e.g. +263774123456"
    );
  }

  const existing = await tx.invitation.findFirst({
    where: {
      phoneNumber,
      invitedById: args.invitedById,
      registered: false,
      storyTags: { none: {} },
    },
  });
  if (existing) return existing;

  const inviteToken = generateToken();
  return tx.invitation.create({
    data: {
      phoneNumber,
      invitedById: args.invitedById,
      inviteToken,
      expiresAt,
      inviteMethod: "sms",
    },
  });
}

export function inviteLink(token: string) {
  return appUrl(`/invite/${token}`);
}

export function toPhoneInviteShare(
  invitation: { inviteToken: string; phoneNumber: string | null },
  copy?: { inviterName?: string | null; relationshipLabel?: string | null }
): PhoneInviteShare | null {
  if (!invitation.phoneNumber) return null;
  const links = buildInviteShareLinks({
    token: invitation.inviteToken,
    phoneNumber: invitation.phoneNumber,
    inviterName: copy?.inviterName,
    relationshipLabel: copy?.relationshipLabel,
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
  if (!args.invitation.email) {
    return {
      ok: false as const,
      provider: null,
      error: "no_email",
      providerError: { provider: null, message: "no_email" },
    };
  }

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
    type: "invitation",
  });
}

/** First touch + last touch; never clears invitationOpenedAt. */
export async function recordInvitationOpened(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteToken: token },
  });
  if (!invitation) return invitation;

  const now = new Date();
  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      invitationOpenedAt: invitation.invitationOpenedAt ?? now,
      lastOpenedAt: now,
    },
  });

  if (!invitation.invitationOpenedAt) {
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
  }

  return updated;
}

export async function setInvitationShareMethod(token: string, method: InviteMethod) {
  return prisma.invitation.updateMany({
    where: { inviteToken: token },
    data: { inviteMethod: method },
  });
}

async function attachStoryTagsForInvitation(
  tx: Prisma.TransactionClient,
  invitationId: string,
  userId: string
) {
  const tags = await tx.storyTag.findMany({
    where: { invitationId },
    select: { id: true, storyId: true },
  });

  const storyIds: string[] = [];

  for (const tag of tags) {
    await tx.storyTag.update({
      where: { id: tag.id },
      data: {
        taggedUserId: userId,
        taggedExternalEmail: null,
        taggedExternalPhone: null,
      },
    });
    storyIds.push(tag.storyId);

    const unresolved = await tx.storyTag.count({
      where: {
        storyId: tag.storyId,
        taggedUserId: null,
        OR: [
          { taggedExternalEmail: { not: null } },
          { taggedExternalPhone: { not: null } },
        ],
      },
    });

    if (unresolved === 0) {
      await tx.story.updateMany({
        where: { id: tag.storyId, status: "draft" },
        data: { status: "published", publishedAt: new Date() },
      });
    }
  }

  return storyIds;
}

/**
 * Associate every pending invitation matching the user's email and/or phone.
 * Does not overwrite history on already-registered invites.
 */
async function associateMatchingPendingInvitations(
  tx: Prisma.TransactionClient,
  args: {
    userId: string;
    email?: string | null;
    phone?: string | null;
    excludeInvitationId: string;
  }
) {
  const or: Prisma.InvitationWhereInput[] = [];
  if (args.email) {
    or.push({ email: args.email.toLowerCase() });
  }
  if (args.phone) {
    or.push({ phoneNumber: args.phone });
  }
  if (!or.length) return [] as string[];

  const matches = await tx.invitation.findMany({
    where: {
      registered: false,
      expiresAt: { gt: new Date() },
      id: { not: args.excludeInvitationId },
      OR: or,
    },
    select: { id: true, invitedById: true },
  });

  const inviterIds: string[] = [];
  const now = new Date();

  for (const match of matches) {
    await tx.invitation.update({
      where: { id: match.id },
      data: {
        registered: true,
        registeredUserId: args.userId,
        acceptedAt: now,
        // activatedAt stays null — only the opened token is the activation source
      },
    });
    await attachStoryTagsForInvitation(tx, match.id, args.userId);
    inviterIds.push(match.invitedById);

    void analyticsService.track({
      userId: args.userId,
      eventType: ANALYTICS_EVENTS.INVITE_ACCEPTED,
      entityType: "invitation",
      entityId: match.id,
      metadata: { associatedVia: "identity_match", activation: false },
    });
  }

  return inviterIds;
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

  // Already associated — return activation story; refresh lastOpenedAt.
  if (invitation.registered) {
    if (
      invitation.registeredUserId &&
      invitation.registeredUserId !== args.userId
    ) {
      return { ok: false as const, reason: "already_registered" as const };
    }
    void prisma.invitation
      .update({
        where: { id: invitation.id },
        data: { lastOpenedAt: new Date() },
      })
      .catch(() => undefined);
    return {
      ok: true as const,
      invitation,
      storyId: invitation.storyTags[0]?.storyId ?? null,
      authorId: invitation.invitedById,
      associatedCount: 0,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { email: true, phone: true, name: true },
  });
  const userEmail = (args.userEmail ?? user?.email)?.toLowerCase() ?? null;
  const userPhone = user?.phone ? normalizePhone(user.phone) : null;

  if (invitation.email) {
    if (!userEmail || userEmail !== invitation.email.toLowerCase()) {
      return { ok: false as const, reason: "email_mismatch" as const };
    }
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    // First-time association only — late invites for existing users must never
    // re-arm the welcome card.
    const priorAssociated = await tx.invitation.count({
      where: { registeredUserId: args.userId, registered: true },
    });

    const row = await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        registered: true,
        registeredUserId: args.userId,
        acceptedAt: now,
        activatedAt: now,
        lastOpenedAt: now,
        invitationOpenedAt: invitation.invitationOpenedAt ?? now,
      },
    });

    await attachStoryTagsForInvitation(tx, invitation.id, args.userId);

    const siblingInviters = await associateMatchingPendingInvitations(tx, {
      userId: args.userId,
      email: userEmail ?? invitation.email,
      phone: userPhone ?? invitation.phoneNumber,
      excludeInvitationId: invitation.id,
    });

    const totalAssociated = 1 + siblingInviters.length;
    if (priorAssociated === 0 && totalAssociated >= 2) {
      await tx.user.update({
        where: { id: args.userId },
        data: { multiInviteWelcomePending: true },
      });
    }

    return { row, siblingInviters };
  });

  const refreshIds = [
    invitation.invitedById,
    args.userId,
    ...result.siblingInviters,
  ];
  void scheduleTrustGraphRefresh([...new Set(refreshIds)]).catch((err) =>
    console.error("[invites] user_connections refresh failed", err)
  );

  void analyticsService.track({
    userId: args.userId,
    eventType: ANALYTICS_EVENTS.INVITE_ACCEPTED,
    entityType: "invitation",
    entityId: invitation.id,
    metadata: {
      activation: true,
      associatedCount: result.siblingInviters.length,
    },
  });

  void analyticsService.track({
    userId: args.userId,
    eventType: ANALYTICS_EVENTS.INVITE_REGISTERED,
    entityType: "invitation",
    entityId: invitation.id,
  });

  const inviteeName = user?.name ?? "Someone";
  void notifyInviteAccepted({
    inviterId: invitation.invitedById,
    inviteeName,
    invitationId: invitation.id,
  }).catch((err) => console.error("[invites] notify failed", err));

  void notifyInviteRegistered({
    inviterId: invitation.invitedById,
    inviteeName,
    invitationId: invitation.id,
  }).catch((err) => console.error("[invites] notify registered failed", err));

  return {
    ok: true as const,
    invitation: result.row,
    storyId: invitation.storyTags[0]?.storyId ?? null,
    authorId: invitation.invitedById,
    associatedCount: result.siblingInviters.length,
  };
}

/**
 * Payload for the one-time multi-invite welcome card.
 * Presentation only — clears the pending flag if data is no longer eligible.
 */
export async function getMultiInviteWelcomePayload(
  userId: string
): Promise<WelcomeCardDisplay | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { multiInviteWelcomePending: true },
  });
  if (!user?.multiInviteWelcomePending) return null;

  const invites = await prisma.invitation.findMany({
    where: { registeredUserId: userId, registered: true },
    select: {
      id: true,
      activatedAt: true,
      acceptedAt: true,
      invitedBy: { select: { name: true } },
    },
  });

  const display = buildWelcomeCardDisplay(
    invites.map((inv) => ({
      invitationId: inv.id,
      name: inv.invitedBy?.name?.trim() || "A friend",
      activatedAt: inv.activatedAt,
      acceptedAt: inv.acceptedAt,
    }))
  );

  if (!display) {
    await prisma.user.update({
      where: { id: userId },
      data: { multiInviteWelcomePending: false },
    });
    return null;
  }

  return display;
}

/** Dismiss forever — late invitations must never re-show the card. */
export async function dismissMultiInviteWelcome(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { multiInviteWelcomePending: false },
  });
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
  if (invitation.expiresAt < new Date()) {
    return { ...invitation, state: "expired" as const };
  }

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
