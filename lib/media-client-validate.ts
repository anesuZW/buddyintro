import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_IMAGE_EDGE_PX,
} from "@/lib/constants";

export type MediaValidateKind = "image" | "video" | "audio";

export type MediaValidateOk = {
  ok: true;
  kind: MediaValidateKind;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type MediaValidateFail = {
  ok: false;
  message: string;
};

export type MediaValidateResult = MediaValidateOk | MediaValidateFail;

function formatMb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

export function oversizeMessage(fileBytes: number, limitMb = MAX_UPLOAD_MB) {
  const actualMb = formatMb(fileBytes);
  return `This file is ${actualMb} MB.\n\nBuddyIntro currently supports uploads up to ${limitMb} MB.`;
}

function inferKind(file: File, preferred?: MediaValidateKind): MediaValidateKind | null {
  if (preferred) return preferred;
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  // Extension fallbacks for empty MIME (common on some Android share targets)
  const name = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/.test(name)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(name)) return "video";
  if (/\.(mp3|m4a|aac|wav|ogg|webm)$/.test(name)) return "audio";
  return null;
}

function loadImageMeta(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image. Try another photo."));
    };
    img.src = url;
  });
}

function loadMediaDuration(file: File, kind: "video" | "audio"): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const duration = el.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error(`Could not read this ${kind}. Try another file.`));
        return;
      }
      resolve(duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read this ${kind}. Try another file.`));
    };
    el.src = url;
  });
}

/**
 * Immediate client-side validation before any upload begins.
 * Rejects oversize files instantly with a friendly message.
 */
export async function validateMediaFile(
  file: File,
  preferredKind?: MediaValidateKind
): Promise<MediaValidateResult> {
  if (!file || file.size <= 0) {
    return { ok: false, message: "Choose a photo or video to continue." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: oversizeMessage(file.size) };
  }

  const kind = inferKind(file, preferredKind);
  if (!kind) {
    return {
      ok: false,
      message: "This file type isn’t supported. Please choose a photo or video.",
    };
  }

  if (preferredKind && kind !== preferredKind) {
    return {
      ok: false,
      message:
        preferredKind === "image"
          ? "Please choose a photo."
          : preferredKind === "video"
            ? "Please choose a video."
            : "Please choose an audio file.",
    };
  }

  try {
    if (kind === "image") {
      const { width, height } = await loadImageMeta(file);
      if (width < 32 || height < 32) {
        return {
          ok: false,
          message: "This image is too small. Please choose a clearer photo.",
        };
      }
      if (width > MAX_IMAGE_EDGE_PX || height > MAX_IMAGE_EDGE_PX) {
        return {
          ok: false,
          message: `This image is too large (${width}×${height}). Please use an image under ${MAX_IMAGE_EDGE_PX}px on each side.`,
        };
      }
      return { ok: true, kind, width, height };
    }

    if (kind === "video") {
      const durationSeconds = await loadMediaDuration(file, "video");
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        return {
          ok: false,
          message: `This video is ${Math.ceil(durationSeconds)} seconds long. BuddyIntro supports videos up to ${MAX_VIDEO_DURATION_SECONDS} seconds.`,
        };
      }
      return { ok: true, kind, durationSeconds };
    }

    const durationSeconds = await loadMediaDuration(file, "audio");
    return { ok: true, kind, durationSeconds };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not validate this file.",
    };
  }
}
