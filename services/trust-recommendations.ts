import "server-only";

import { prisma } from "@/lib/prisma";
import { getSharedIntroducersForPair } from "@/lib/shared-introducers";
import { getAdminSettings } from "@/services/admin";
import { getCachedTrustRecommendations } from "@/lib/perf-cache";
import { isProfileEnabled } from "@/lib/profile/route-profiler";

export type TrustRecommendation = {
  id: string;
  title: string;
  message: string;
  href: string;
  priority: number;
};

export async function getTrustRecommendations(userId: string): Promise<TrustRecommendation[]> {
  return getCachedTrustRecommendations(userId, () => computeTrustRecommendations(userId));
}

async function computeTrustRecommendations(userId: string): Promise<TrustRecommendation[]> {
  const profile = isProfileEnabled();
  const marks: Record<string, number> = {};
  let last = performance.now();
  const mark = (label: string) => {
    if (!profile) return;
    const now = performance.now();
    marks[label] = Math.round(now - last);
    last = now;
  };

  const settings = await getAdminSettings();
  mark("adminSettings");
  if (!settings.enableTrustRecommendations) return [];

  const connections = await prisma.userConnection.findMany({
    where: { sourceUserId: userId, degree: { lte: 2 } },
    orderBy: [{ sharedIntroducerCount: "desc" }, { trustScore: "desc" }],
    take: 12,
    include: {
      targetUser: { select: { id: true, name: true } },
    },
  });
  mark("queryConnections");

  const recs: TrustRecommendation[] = [];

  for (const conn of connections.slice(0, 5)) {
    const shared = conn.sharedIntroducerCount;
    if (shared < 2) continue;
    recs.push({
      id: `shared-${conn.targetUserId}`,
      title: "Shared trust path",
      message: `You and ${conn.targetUser.name} share ${shared} trusted introducer${shared === 1 ? "" : "s"}.`,
      href: `/profile/${conn.targetUserId}`,
      priority: 100 - shared,
    });
  }

  if (connections.length >= 2) {
    const a = connections[0];
    const b = connections[1];
    if (a.sharedIntroducerCount >= 3 && b.sharedIntroducerCount >= 3) {
      recs.push({
        id: `intro-${a.targetUserId}-${b.targetUserId}`,
        title: "Introduction opportunity",
        message: `Consider introducing ${a.targetUser.name} and ${b.targetUser.name} — both are in your trusted network.`,
        href: `/create-story`,
        priority: 50,
      });
    }
  }
  mark("loops");

  const topPair = connections[0];
  if (topPair && topPair.sharedIntroducerCount >= 5) {
    const introducers = await getSharedIntroducersForPair(userId, topPair.targetUserId);
    mark("sharedIntroducersForPair");
    const names = introducers.slice(0, 2).map((i) => i.introducer.name);
    if (names.length) {
      recs.push({
        id: `introducers-${topPair.targetUserId}`,
        title: "Strong mutual trust",
        message: `Introduced by ${names.join(", ")}${introducers.length > 2 ? ` and ${introducers.length - 2} others` : ""}.`,
        href: `/profile/${topPair.targetUserId}`,
        priority: 10,
      });
    }
  }

  if (profile) {
    console.log(
      `[PROFILE] computeTrustRecommendations\n${Object.entries(marks)
        .map(([k, v]) => `${k}=${v}ms`)
        .join("\n")}`
    );
  }

  return recs.sort((x, y) => x.priority - y.priority).slice(0, 6);
}
