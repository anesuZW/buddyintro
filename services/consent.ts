import "server-only";

import { prisma } from "@/lib/prisma";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export async function recordUserConsent(args: {
  userId: string;
  privacyVersion?: string;
  termsVersion?: string;
  cookieVersion?: string | null;
  ipAddress?: string | null;
  country?: string | null;
}) {
  return prisma.userConsent.create({
    data: {
      userId: args.userId,
      privacyVersion: args.privacyVersion ?? LEGAL_VERSIONS.privacy,
      termsVersion: args.termsVersion ?? LEGAL_VERSIONS.terms,
      cookieVersion: args.cookieVersion ?? null,
      ipAddress: args.ipAddress ?? null,
      country: args.country ?? null,
    },
  });
}

export async function getLatestConsent(userId: string) {
  return prisma.userConsent.findFirst({
    where: { userId },
    orderBy: { acceptedAt: "desc" },
  });
}

export async function exportUserData(userId: string) {
  const [user, stories, tags, messages, posts, discoveries, consents] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.story.findMany({ where: { userId } }),
      prisma.storyTag.findMany({ where: { taggedUserId: userId } }),
      prisma.message.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      }),
      prisma.post.findMany({ where: { userId } }),
      prisma.discoveriesPost.findMany({ where: { userId } }),
      prisma.userConsent.findMany({ where: { userId } }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    stories,
    storyTags: tags,
    messages,
    posts,
    discoveriesPosts: discoveries,
    consents,
  };
}

export async function deleteUserAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}
