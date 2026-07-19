import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/branding";
import { resolveAppLocale, translateMessage } from "@/lib/i18n/messages";
import type { AppLocale } from "@/i18n/routing";

export async function getUserLocale(userId: string): Promise<AppLocale> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLanguage: true },
  });
  return resolveAppLocale(user?.preferredLanguage);
}

async function t(locale: AppLocale, key: string, values?: Record<string, string | number>) {
  return translateMessage(locale, key, values);
}

export async function buildIntroductionReceivedNotification(
  locale: AppLocale,
  authorName: string
) {
  return {
    title: await t(locale, "notifications.introductionReceivedTitle"),
    message: await t(locale, "notifications.introductionReceivedMessage", {
      authorName,
      appName: BRAND.name,
    }),
  };
}

export async function buildMessageReceivedNotification(
  locale: AppLocale,
  senderName: string,
  preview: string
) {
  return {
    title: await t(locale, "notifications.messageReceivedTitle"),
    message: await t(locale, "notifications.messageReceivedMessage", {
      senderName,
      preview: preview.slice(0, 120),
    }),
  };
}

export async function buildDiscoveryEngagementNotification(
  locale: AppLocale,
  kind: "liked" | "commented" | "shared",
  actorName: string,
  preview?: string
) {
  const titleKey = {
    liked: "notifications.discoveryLikedTitle",
    commented: "notifications.discoveryCommentedTitle",
    shared: "notifications.discoverySharedTitle",
  }[kind];

  const message =
    kind === "commented" && preview
      ? await t(locale, "notifications.discoveryCommentedMessage", {
          actorName,
          preview: preview.slice(0, 100),
        })
      : kind === "liked"
        ? await t(locale, "notifications.discoveryLikedMessage", { actorName })
        : await t(locale, "notifications.discoverySharedMessage", { actorName });

  return {
    title: await t(locale, titleKey),
    message,
  };
}

export async function buildInviteNotification(
  locale: AppLocale,
  kind: "accepted" | "opened" | "registered",
  inviteeName?: string
) {
  const map = {
    accepted: {
      title: "notifications.inviteAcceptedTitle",
      message: "notifications.inviteAcceptedMessage",
    },
    opened: {
      title: "notifications.inviteOpenedTitle",
      message: "notifications.inviteOpenedMessage",
    },
    registered: {
      title: "notifications.inviteRegisteredTitle",
      message: "notifications.inviteRegisteredMessage",
    },
  }[kind];

  return {
    title: await t(locale, map.title),
    message: inviteeName
      ? await t(locale, map.message, { inviteeName })
      : await t(locale, map.message),
  };
}

export async function buildDiscoveryMessageNotification(locale: AppLocale, actorName: string) {
  return {
    title: await t(locale, "notifications.discoveryMessageTitle"),
    message: await t(locale, "notifications.discoveryMessageMessage", { actorName }),
  };
}

export async function buildTrustScoreNotification(
  locale: AppLocale,
  otherName: string,
  score: number,
  count: number
) {
  return {
    title: await t(locale, "notifications.trustScoreTitle"),
    message: await t(locale, "notifications.trustScoreMessage", { otherName, score, count }),
  };
}

export async function buildSharedIntroducerNotification(
  locale: AppLocale,
  otherName: string,
  introducerName: string
) {
  return {
    title: await t(locale, "notifications.sharedIntroducerTitle"),
    message: await t(locale, "notifications.sharedIntroducerMessage", { otherName, introducerName }),
  };
}

export async function buildVerificationNotification(
  locale: AppLocale,
  kind: "phone" | "identity" | "approved" | "rejected"
) {
  const map = {
    phone: ["notifications.phoneVerifiedTitle", "notifications.phoneVerifiedMessage"],
    identity: ["notifications.identityVerifiedTitle", "notifications.identityVerifiedMessage"],
    approved: ["notifications.verificationApprovedTitle", "notifications.verificationApprovedMessage"],
    rejected: ["notifications.verificationRejectedTitle", "notifications.verificationRejectedMessage"],
  }[kind];

  return {
    title: await t(locale, map[0]),
    message: await t(locale, map[1]),
  };
}
