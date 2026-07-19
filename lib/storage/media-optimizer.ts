import "server-only";

import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import type { ImageVariantName, MediaVariantUrls, VideoVariantName } from "@/lib/storage/types";
import {
  IMAGE_VARIANT_WIDTHS,
  imageVariantStoragePath,
  stripVariantSuffix,
  videoPosterStoragePath,
  videoPreviewStoragePath,
  videoVariantStoragePath,
} from "@/lib/storage/paths";

export type OptimizedImageSet = {
  baseId: string;
  paths: Record<ImageVariantName | "original", string>;
  buffers: Record<ImageVariantName | "original", Buffer>;
};

export type TranscodedVideoSet = {
  videoPath: string;
  paths: Partial<Record<VideoVariantName | "original" | "preview" | "poster", string>>;
};

const WEBP_QUALITY = Number(process.env.MEDIA_WEBP_QUALITY || 82);

function runCommand(command: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    const { code } = await runCommand("ffmpeg", ["-version"]);
    return code === 0;
  } catch {
    return false;
  }
}

async function webpBuffer(input: Buffer, width?: number): Promise<Buffer> {
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  if (width) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true });
  }
  return pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
}

/** Generate tiny/thumb/medium/large/original WebP variants. */
export async function optimizeImageVariants(
  input: Buffer,
  baseId: string
): Promise<OptimizedImageSet> {
  const base = stripVariantSuffix(baseId);
  const variants: ImageVariantName[] = ["tiny", "thumb", "medium", "large"];

  const entries = await Promise.all([
    ...variants.map(async (variant) => {
      const buffer = await webpBuffer(input, IMAGE_VARIANT_WIDTHS[variant]);
      return [variant, buffer] as const;
    }),
    (async () => ["original", await webpBuffer(input)] as const)(),
  ]);

  const buffers = Object.fromEntries(entries) as OptimizedImageSet["buffers"];
  const paths = {
    tiny: imageVariantStoragePath(base, "tiny"),
    thumb: imageVariantStoragePath(base, "thumb"),
    medium: imageVariantStoragePath(base, "medium"),
    large: imageVariantStoragePath(base, "large"),
    original: imageVariantStoragePath(base, "original"),
  };

  return { baseId: base, paths, buffers };
}

export async function generateVideoPreviewThumbnail(
  videoAbsolutePath: string
): Promise<Buffer | null> {
  if (!(await isFfmpegAvailable())) {
    console.warn("[media-optimizer] ffmpeg unavailable — skipping video preview");
    return null;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "buddyintro-video-thumb-"));
  const framePath = join(tempDir, "frame.png");

  try {
    const { code, stderr } = await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      "00:00:01",
      "-i",
      videoAbsolutePath,
      "-vframes",
      "1",
      "-vf",
      `scale=${IMAGE_VARIANT_WIDTHS.medium}:-1`,
      framePath,
    ]);

    if (code !== 0) {
      console.warn(`[media-optimizer] ffmpeg preview failed: ${stderr.trim() || "unknown"}`);
      return null;
    }

    const frame = await readFile(framePath);
    return webpBuffer(frame, IMAGE_VARIANT_WIDTHS.medium);
  } catch (err) {
    console.warn(
      `[media-optimizer] video preview failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function transcodeVideoVariants(
  videoAbsolutePath: string,
  canonicalVideoPath: string
): Promise<TranscodedVideoSet> {
  const paths: TranscodedVideoSet["paths"] = {
    original: videoVariantStoragePath(canonicalVideoPath, "original"),
    preview: videoPreviewStoragePath(canonicalVideoPath),
    poster: videoPosterStoragePath(canonicalVideoPath),
  };

  if (!(await isFfmpegAvailable())) {
    console.warn("[media-optimizer] ffmpeg unavailable — skipping video transcoding");
    return { videoPath: canonicalVideoPath, paths };
  }

  const tempDir = await mkdtemp(join(tmpdir(), "buddyintro-video-transcode-"));
  try {
    for (const variant of ["480p", "720p", "1080p"] as VideoVariantName[]) {
      const height = variant === "480p" ? 480 : variant === "720p" ? 720 : 1080;
      const outputPath = join(tempDir, `${variant}.mp4`);
      const targetStoragePath = videoVariantStoragePath(canonicalVideoPath, variant);
      paths[variant] = targetStoragePath;

      const { code, stderr } = await runCommand("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoAbsolutePath,
        "-vf",
        `scale=-2:${height}`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        outputPath,
      ]);

      if (code !== 0) {
        console.warn(`[media-optimizer] transcode ${variant} failed: ${stderr.trim()}`);
        delete paths[variant];
        continue;
      }

      paths[variant] = targetStoragePath;
    }

    return { videoPath: canonicalVideoPath, paths };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Read transcoded file buffers from temp dir after transcodeVideoVariants writes them. */
export async function readTranscodedOutputs(
  transcode: TranscodedVideoSet,
  tempOutputDir: string
): Promise<Map<string, Buffer>> {
  const map = new Map<string, Buffer>();
  for (const variant of ["480p", "720p", "1080p"] as VideoVariantName[]) {
    const storagePath = transcode.paths[variant];
    if (!storagePath) continue;
    const file = join(tempOutputDir, `${variant}.mp4`);
    try {
      map.set(storagePath, await readFile(file));
    } catch {
      /* skip missing variant */
    }
  }
  return map;
}

export function imageVariantUrlsFromPaths(
  paths: OptimizedImageSet["paths"],
  toPublicUrl: (storagePath: string) => string
): MediaVariantUrls {
  return {
    tiny: toPublicUrl(paths.tiny),
    thumb: toPublicUrl(paths.thumb),
    medium: toPublicUrl(paths.medium),
    large: toPublicUrl(paths.large),
    original: toPublicUrl(paths.original),
  };
}

export function videoVariantUrlsFromPaths(
  paths: TranscodedVideoSet["paths"],
  toPublicUrl: (storagePath: string) => string
): MediaVariantUrls {
  const urls: MediaVariantUrls = {};
  for (const [variant, storagePath] of Object.entries(paths)) {
    if (storagePath) urls[variant as keyof MediaVariantUrls] = toPublicUrl(storagePath);
  }
  return urls;
}

export async function writeTranscodeVariant(
  videoAbsolutePath: string,
  canonicalVideoPath: string,
  variant: VideoVariantName,
  outputAbsolutePath: string
): Promise<boolean> {
  if (!(await isFfmpegAvailable())) return false;
  const height = variant === "480p" ? 480 : variant === "720p" ? 720 : 1080;
  const { code } = await runCommand("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    videoAbsolutePath,
    "-vf",
    `scale=-2:${height}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputAbsolutePath,
  ]);
  return code === 0;
}

export async function writePreviewAndPoster(
  videoAbsolutePath: string,
  previewAbsolutePath: string,
  posterAbsolutePath: string
): Promise<void> {
  const preview = await generateVideoPreviewThumbnail(videoAbsolutePath);
  if (!preview) return;
  await writeFile(previewAbsolutePath, preview);
  await writeFile(posterAbsolutePath, await webpBuffer(preview, IMAGE_VARIANT_WIDTHS.large));
}
