import "server-only";

import { createHash } from "crypto";
import { readdir, stat, unlink } from "fs/promises";
import { join, relative, resolve, sep } from "path";
import { prisma } from "@/lib/prisma";
import { getMediaRoot } from "@/lib/storage/config";
import { collectVariantStoragePaths, normalizeStoragePath } from "@/lib/storage/paths";
import { extractStoragePath } from "@/lib/storage-url";

export type MediaCleanupReport = {
  scanned: number;
  candidates: number;
  deleted: number;
  reclaimedBytes: number;
  dryRun: boolean;
  maxAgeHours: number;
  deletedPaths: string[];
  skippedReferenced: number;
  completedAt: string;
};

async function walkFiles(root: string, dir = root): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, absolute)));
    } else if (entry.isFile()) {
      files.push(relative(root, absolute).replace(/\\/g, "/"));
    }
  }
  return files;
}

async function collectReferencedStoragePaths(): Promise<Set<string>> {
  const referenced = new Set<string>();

  const addStored = (stored: string | null | undefined) => {
    if (!stored) return;
    const path = extractStoragePath(stored) ?? normalizeStoragePath(stored);
    if (!path) return;
    referenced.add(path);
    for (const variant of collectVariantStoragePaths(path)) {
      referenced.add(variant);
    }
  };

  // Only paths attached to user-visible entities count as "in use".
  // media_objects alone are NOT referenced — otherwise upload-then-abandon
  // orphans can never be reclaimed (registry row protected the file forever).
  const [users, stories, discoveriesPosts] = await Promise.all([
    prisma.user.findMany({ where: { profilePicture: { not: null } }, select: { profilePicture: true } }),
    prisma.story.findMany({ select: { mediaUrl: true, voiceNoteUrl: true } }),
    prisma.discoveriesPost.findMany({ where: { mediaUrl: { not: null } }, select: { mediaUrl: true } }),
  ]);

  for (const user of users) addStored(user.profilePicture);
  for (const story of stories) {
    addStored(story.mediaUrl);
    addStored(story.voiceNoteUrl);
  }
  for (const post of discoveriesPosts) addStored(post.mediaUrl);

  return referenced;
}

function etagForBuffer(data: Buffer): string {
  return `"${createHash("sha256").update(data).digest("hex").slice(0, 16)}"`;
}

export async function runMediaCleanup(opts: {
  dryRun?: boolean;
  maxAgeHours?: number;
} = {}): Promise<MediaCleanupReport> {
  const dryRun = opts.dryRun ?? false;
  const maxAgeHours = opts.maxAgeHours ?? 24;
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const root = resolve(getMediaRoot());
  const referenced = await collectReferencedStoragePaths();

  const report: MediaCleanupReport = {
    scanned: 0,
    candidates: 0,
    deleted: 0,
    reclaimedBytes: 0,
    dryRun,
    maxAgeHours,
    deletedPaths: [],
    skippedReferenced: 0,
    completedAt: new Date().toISOString(),
  };

  const files = await walkFiles(root);
  report.scanned = files.length;

  for (const relativePath of files) {
    const normalized = normalizeStoragePath(relativePath);
    const absolute = resolve(root, normalized);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) continue;

    const fileStat = await stat(absolute);
    if (fileStat.mtimeMs > cutoff) continue;

    if (referenced.has(normalized)) {
      report.skippedReferenced++;
      continue;
    }

    report.candidates++;
    if (dryRun) continue;

    await unlink(absolute);
    report.deleted++;
    report.reclaimedBytes += fileStat.size;
    if (report.deletedPaths.length < 100) {
      report.deletedPaths.push(normalized);
    }

    // Drop registry rows for reclaimed orphans so dedupe/DB stay consistent.
    await prisma.mediaObject
      .deleteMany({ where: { storagePath: normalized } })
      .catch(() => undefined);
  }

  console.info(
    `[media-cleanup] scanned=${report.scanned} deleted=${report.deleted} reclaimed=${report.reclaimedBytes} dryRun=${dryRun}`
  );

  return report;
}

export { etagForBuffer };
