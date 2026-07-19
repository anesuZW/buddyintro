"use client";

import { useState } from "react";
import type { MediaVariantUrls } from "@/lib/storage/types";

export type UploadKind = "image" | "video" | "audio";

export type UploadResult = {
  url: string;
  path: string;
  variants?: MediaVariantUrls;
  contentType?: string;
};

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function upload(
    file: Blob | File,
    opts: { userId: string; kind: UploadKind; ext?: string }
  ): Promise<UploadResult> {
    setUploading(true);
    setProgress(10);
    try {
      const form = new FormData();
      form.append("file", file, file instanceof File ? file.name : `${opts.kind}.${opts.ext || "bin"}`);
      form.append("kind", opts.kind);
      if (opts.ext) form.append("ext", opts.ext);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: form,
      });

      setProgress(90);

      const body = (await res.json().catch(() => ({}))) as UploadResult & { error?: string };

      if (!res.ok) {
        throw new Error(body.error || `Upload failed (${res.status})`);
      }

      if (!body.url || !body.path) {
        throw new Error("Upload response missing url/path");
      }

      setProgress(100);
      return {
        url: body.url,
        path: body.path,
        variants: body.variants,
        contentType: body.contentType,
      };
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, progress };
}
