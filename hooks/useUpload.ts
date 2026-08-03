"use client";

import { useCallback, useRef, useState } from "react";
import {
  transportUpload,
  type UploadKind,
  type UploadProgress,
  type UploadResult,
} from "@/lib/upload-transport";

export type { UploadKind, UploadProgress, UploadResult };

type UploadOptions = {
  userId: string;
  kind: UploadKind;
  ext?: string;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  retries?: number;
};

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  async function upload(file: Blob | File, opts: UploadOptions): Promise<UploadResult> {
    if (inFlightRef.current) {
      throw new Error("An upload is already in progress. Cancel it or wait for it to finish.");
    }

    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    setUploading(true);
    setProgress(0);

    const external = opts.signal;
    const onExternalAbort = () => controller.abort();
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      return await transportUpload(file, {
        kind: opts.kind,
        ext: opts.ext,
        signal: controller.signal,
        retries: opts.retries,
        onProgress: (p) => {
          setProgress(p.percent);
          opts.onProgress?.(p);
        },
      });
    } finally {
      if (external) external.removeEventListener("abort", onExternalAbort);
      setUploading(false);
      abortRef.current = null;
      inFlightRef.current = false;
    }
  }

  return { upload, uploading, progress, cancel };
}
