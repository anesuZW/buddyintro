import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { appLogger } from "@/lib/logger";

export type ShareDraftCookie = {
  content: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  fileName?: string | null;
  at: number;
  intent?: "discovery" | "story";
};

function inferKind(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const name = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/.test(name)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(name)) return "video";
  return null;
}

function extFromFile(file: File, kind: "image" | "video") {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : undefined;
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (kind === "image") return "jpg";
  return "mp4";
}

/**
 * Web Share Target handler.
 * When the user is signed in and shares a photo/video, upload bytes immediately
 * and stash a draft cookie so /share (or create-story) can preload media.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const title = String(form.get("title") ?? "");
  const text = String(form.get("text") ?? "");
  const url = String(form.get("url") ?? "");
  const file = form.get("media");

  let mediaUrl: string | null = null;
  let mediaType: "image" | "video" | null = null;
  let fileName: string | null = null;
  let mediaHint: string | null = null;
  if (file instanceof File && file.size > 0) {
    fileName = file.name;
    const kind = inferKind(file);
    mediaHint = `[Shared ${file.type || "file"}: ${file.name}]`;

    if (kind && file.size <= MAX_UPLOAD_BYTES) {
      const auth = await requireUserApi();
      if (!(auth instanceof NextResponse) && !isApiAuthError(auth)) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const provider = getStorageProvider();
          const result = await provider.upload(buffer, {
            userId: auth.id,
            kind,
            ext: extFromFile(file, kind),
            contentType: file.type || undefined,
          });
          mediaUrl = result.publicUrl;
          mediaType = kind;
          mediaHint = null;
        } catch (err) {
          appLogger.error("share target media upload failed", {
            route: "share/target",
            error: err instanceof Error ? err.message : String(err),
          });
          mediaHint = `[Shared ${file.type || "file"}: ${file.name} — upload failed, please re-attach]`;
        }
      }
    } else if (kind && file.size > MAX_UPLOAD_BYTES) {
      mediaHint = `Shared file was too large (${(file.size / (1024 * 1024)).toFixed(0)} MB).`;
    }
  }

  const content = [title, text, url, mediaHint].filter(Boolean).join("\n\n");

  const draft: ShareDraftCookie = {
    content,
    mediaUrl,
    mediaType,
    fileName,
    intent: "discovery",
    at: Date.now(),
  };

  cookies().set("fi-share-draft", JSON.stringify(draft), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 3600,
    path: "/",
  });

  // Always review on /share — media is preloaded there. create-story cannot
  // yet consume a remote mediaUrl without re-picking a file.
  return NextResponse.redirect(new URL("/share?draft=1", request.url), 303);
}
