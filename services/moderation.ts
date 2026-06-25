import "server-only";

import { prisma } from "@/lib/prisma";
import type { ReportStatus, ReportTargetType } from "@prisma/client";

export async function isUserBlocked(userA: string, userB: string) {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
  });
  return Boolean(row);
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error("You cannot block yourself");
  return prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  return prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
}

export async function listBlockedUserIds(userId: string) {
  const rows = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  }
  return Array.from(ids);
}

export async function createReport(args: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}) {
  return prisma.contentReport.create({
    data: {
      reporterId: args.reporterId,
      targetType: args.targetType,
      targetId: args.targetId,
      reason: args.reason.slice(0, 200),
      details: args.details?.slice(0, 2000) ?? null,
    },
  });
}

export async function listPendingReports(limit = 50) {
  return prisma.contentReport.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function resolveReport(args: {
  reportId: string;
  reviewerId: string;
  status: Exclude<ReportStatus, "pending">;
  resolution?: string;
}) {
  return prisma.contentReport.update({
    where: { id: args.reportId },
    data: {
      status: args.status,
      reviewedById: args.reviewerId,
      reviewedAt: new Date(),
      resolution: args.resolution?.slice(0, 1000) ?? null,
    },
  });
}

export async function suspendUser(userId: string, suspend: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: suspend ? new Date() : null },
  });
}

export async function banUser(userId: string, ban: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { bannedAt: ban ? new Date() : null, suspendedAt: ban ? new Date() : undefined },
  });
}

export async function getBlockStatus(viewerId: string, otherUserId: string) {
  const blockedByMe = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: viewerId, blockedId: otherUserId } },
  });
  const blockedMe = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: otherUserId, blockedId: viewerId } },
  });
  return {
    blockedByMe: Boolean(blockedByMe),
    blockedMe: Boolean(blockedMe),
    eitherBlocked: Boolean(blockedByMe || blockedMe),
  };
}
