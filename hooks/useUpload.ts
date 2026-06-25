"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { STORAGE_BUCKET } from "@/lib/constants";
import { mediaProxyPath } from "@/lib/storage-url";

export type UploadKind = "image" | "video" | "audio";

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function upload(
    file: Blob | File,
    opts: { userId: string; kind: UploadKind; ext?: string }
  ): Promise<{ url: string; path: string }> {
    setUploading(true);
    setProgress(0);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext =
        opts.ext ||
        (file instanceof File && file.name.includes(".")
          ? file.name.split(".").pop()
          : opts.kind === "audio"
            ? "webm"
            : opts.kind === "video"
              ? "mp4"
              : "jpg");

      const path = `${opts.userId}/${opts.kind}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          contentType:
            file instanceof File ? file.type || undefined : (file as Blob).type,
          upsert: false,
        });

      if (error) throw error;
      setProgress(100);

      return { url: mediaProxyPath(path), path };
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, progress };
}
