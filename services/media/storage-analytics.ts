import "server-only";

import { readdir, stat } from "fs/promises";
import type { Dirent } from "fs";
import { join, relative, resolve } from "path";
import { prisma } from "@/lib/prisma";
import { getMediaRoot } from "@/lib/storage/config";
import { normalizeStoragePath } from "@/lib/storage/paths";

export type StorageAnalytics = {
  totals: {
    files: number;
    bytes: number;
    images: number;
    videos: number;
    audio: number;
    thumbnails: number;
  };
  mediaObjects: {
    total: number;
    pending: number;
    processing: number;
    ready: number;
    failed: number;
    deduplicatedRefs: number;
  };
  averages: {
    uploadBytes: number;
    compressionSavingsBytes: number;
  };
  largestUsers: Array<{ userId: string; bytes: number; files: number }>;
  topConsumers: Array<{ userId: string; bytes: number; count: number }>;
  dailyUploads: Array<{ date: string; count: number; bytes: number }>;
  growth: Array<{ date: string; cumulativeBytes: number }>;
};

async function walkStats(root: string, dir = root): Promise<{
  files: number;
  bytes: number;
  images: number;
  videos: number;
  audio: number;
  thumbnails: number;
  byUser: Map<string, { bytes: number; files: number }>;
}> {
  const stats = {
    files: 0,
    bytes: 0,
    images: 0,
    videos: 0,
    audio: 0,
    thumbnails: 0,
    byUser: new Map<string, { bytes: number; files: number }>(),
  };

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return stats;
  }

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkStats(root, absolute);
      stats.files += nested.files;
      stats.bytes += nested.bytes;
      stats.images += nested.images;
      stats.videos += nested.videos;
      stats.audio += nested.audio;
      stats.thumbnails += nested.thumbnails;
      for (const [userId, value] of nested.byUser) {
        const current = stats.byUser.get(userId) ?? { bytes: 0, files: 0 };
        stats.byUser.set(userId, {
          bytes: current.bytes + value.bytes,
          files: current.files + value.files,
        });
      }
      continue;
    }

    if (!entry.isFile()) continue;
    const rel = normalizeStoragePath(relative(root, absolute));
    const fileStat = await stat(absolute);
    stats.files++;
    stats.bytes += fileStat.size;

    if (rel.startsWith("images/")) stats.images++;
    else if (rel.startsWith("videos/")) stats.videos++;
    else if (rel.startsWith("audio/")) stats.audio++;
    else if (rel.startsWith("thumbnails/")) stats.thumbnails++;
    else if (rel.includes("/image/")) stats.images++;
    else if (rel.includes("/video/")) stats.videos++;
    else if (rel.includes("/audio/")) stats.audio++;

    const userId = inferUserIdFromPath(rel);
    if (userId) {
      const current = stats.byUser.get(userId) ?? { bytes: 0, files: 0 };
      stats.byUser.set(userId, {
        bytes: current.bytes + fileStat.size,
        files: current.files + 1,
      });
    }
  }

  return stats;
}

function inferUserIdFromPath(path: string): string | null {
  const segments = path.split("/");
  if (segments[0] === "images" || segments[0] === "videos" || segments[0] === "audio") {
    return segments[3] ?? null;
  }
  if (segments[0] === "thumbnails" && segments.length >= 5 && /^\d{4}$/.test(segments[1]!)) {
    return segments[3] ?? null;
  }
  if (/^[0-9a-f-]{36}$/i.test(segments[0]!)) return segments[0]!;
  if (segments[0] === "thumbnails" && /^[0-9a-f-]{36}$/i.test(segments[1]!)) return segments[1]!;
  return null;
}

export async function queryStorageAnalytics(days = 30): Promise<StorageAnalytics> {
  const root = resolve(getMediaRoot());
  const fsStats = await walkStats(root);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [statusCounts, recentObjects, dedupAgg] = await Promise.all([
    prisma.mediaObject.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.mediaObject.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, byteSize: true, ownerId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mediaObject.aggregate({
      _sum: { refCount: true, byteSize: true },
      _count: { _all: true },
    }),
  ]);

  const statusMap = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all]));
  const dailyMap = new Map<string, { count: number; bytes: number }>();
  for (const row of recentObjects) {
    const date = row.createdAt.toISOString().slice(0, 10);
    const current = dailyMap.get(date) ?? { count: 0, bytes: 0 };
    dailyMap.set(date, {
      count: current.count + 1,
      bytes: current.bytes + row.byteSize,
    });
  }

  const dailyUploads = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, ...value }));

  let cumulative = 0;
  const growth = dailyUploads.map((day) => {
    cumulative += day.bytes;
    return { date: day.date, cumulativeBytes: cumulative };
  });

  const largestUsers = [...fsStats.byUser.entries()]
    .map(([userId, value]) => ({ userId, ...value }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const consumerMap = new Map<string, { bytes: number; count: number }>();
  for (const row of recentObjects) {
    const current = consumerMap.get(row.ownerId) ?? { bytes: 0, count: 0 };
    consumerMap.set(row.ownerId, {
      bytes: current.bytes + row.byteSize,
      count: current.count + 1,
    });
  }

  const topConsumers = [...consumerMap.entries()]
    .map(([userId, value]) => ({ userId, ...value }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const totalObjects = dedupAgg._count._all;
  const avgUpload = totalObjects ? Math.round((dedupAgg._sum.byteSize ?? 0) / totalObjects) : 0;
  const deduplicatedRefs = Math.max(0, (dedupAgg._sum.refCount ?? 0) - totalObjects);

  return {
    totals: {
      files: fsStats.files,
      bytes: fsStats.bytes,
      images: fsStats.images,
      videos: fsStats.videos,
      audio: fsStats.audio,
      thumbnails: fsStats.thumbnails,
    },
    mediaObjects: {
      total: totalObjects,
      pending: statusMap.pending ?? 0,
      processing: statusMap.processing ?? 0,
      ready: statusMap.ready ?? 0,
      failed: statusMap.failed ?? 0,
      deduplicatedRefs,
    },
    averages: {
      uploadBytes: avgUpload,
      compressionSavingsBytes: Math.max(0, fsStats.bytes - (dedupAgg._sum.byteSize ?? 0)),
    },
    largestUsers,
    topConsumers,
    dailyUploads,
    growth,
  };
}
