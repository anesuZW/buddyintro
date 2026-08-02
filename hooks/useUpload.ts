"use client";

import { useCallback, useRef, useState } from "react";
import type { MediaVariantUrls } from "@/lib/storage/types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/constants";

export type UploadKind = "image" | "video" | "audio";

export type UploadResult = {
  url: string;
  path: string;
  variants?: MediaVariantUrls;
  contentType?: string;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

type UploadOptions = {
  userId: string;
  kind: UploadKind;
  ext?: string;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  retries?: number;
};

type UploadErrorBody = {
  error?: string;
  reason?: string;
  code?: string;
  rejectSource?: string;
  limitMb?: number;
};

type UploadResponse = {
  status: number;
  body: UploadResult & UploadErrorBody;
  rejectSource: string | null;
  rejectCode: string | null;
};

function formatUploadError(
  status: number,
  body: UploadErrorBody,
  headers?: { rejectSource?: string | null; rejectCode?: string | null }
) {
  const reason = body.reason || body.error;
  const rejectSource = body.rejectSource || headers?.rejectSource || undefined;
  const code = body.code || headers?.rejectCode || undefined;

  if (status === 413) {
    if (body.code === "proxy_body_limit") {
      return `Upload blocked by the server proxy (limit ~${body.limitMb ?? 1} MB). Contact support or try a smaller file.`;
    }
    return body.reason || body.error || `File exceeds the ${MAX_UPLOAD_MB} MB upload limit.`;
  }
  if (status === 401) {
    return body.reason || "You must be signed in to upload.";
  }
  if (status === 403) {
    if (code === "csrf_rejected" || rejectSource === "csrf") {
      return body.reason || "Upload blocked: request origin not allowed.";
    }
    return body.reason || body.error || "Upload not permitted.";
  }
  if (status === 503 || code === "service_unavailable") {
    return (
      body.reason ||
      "BuddyIntro is temporarily unavailable. Please retry the upload in a moment."
    );
  }
  if (reason) return reason;
  if (rejectSource && code) {
    return `Upload failed (${rejectSource}: ${code})`;
  }
  return `Upload failed (${status})`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return !status || status >= 500;
}

function uploadWithProgress(
  form: FormData,
  opts: { signal?: AbortSignal; onProgress?: (p: UploadProgress) => void }
): Promise<UploadResponse> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Upload is only available in the browser"));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");
    xhr.responseType = "json";
    xhr.timeout = 120_000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !opts.onProgress) return;
      opts.onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    };

    xhr.onload = () => {
      resolve({
        status: xhr.status,
        body: (xhr.response ?? {}) as UploadResult & UploadErrorBody,
        rejectSource: xhr.getResponseHeader("X-Upload-Reject-Source"),
        rejectCode: xhr.getResponseHeader("X-Upload-Reject-Code"),
      });
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Check your connection and try again."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}

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

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_UPLOAD_MB} MB.`
      );
    }

    const retries = opts.retries ?? 2;
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;

    setUploading(true);
    setProgress(0);

    const form = new FormData();
    form.append(
      "file",
      file,
      file instanceof File ? file.name : `${opts.kind}.${opts.ext || "bin"}`
    );
    form.append("kind", opts.kind);
    if (opts.ext) form.append("ext", opts.ext);

    let lastError: Error | null = null;

    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (controller.signal.aborted) {
          throw new DOMException("Upload cancelled", "AbortError");
        }

        try {
          const { status, body, rejectSource, rejectCode } = await uploadWithProgress(form, {
            signal: controller.signal,
            onProgress: (p) => {
              setProgress(p.percent);
              opts.onProgress?.(p);
            },
          });

          // Retry only transport / 5xx (incl. 503). Never retry 4xx client errors.
          if (isRetryableStatus(status)) {
            lastError = new Error(formatUploadError(status, body, { rejectSource, rejectCode }));
            if (attempt < retries) {
              await sleep(500 * Math.pow(2, attempt));
              continue;
            }
            throw lastError;
          }

          if (status < 200 || status >= 300) {
            const detail =
              rejectSource && rejectCode && !body.reason
                ? ` [rejectSource=${rejectSource}, code=${rejectCode}]`
                : status === 413 && !body.code
                  ? " [likely nginx — HTML 413 with no app JSON; check nginx error.log]"
                  : "";
            throw new Error(
              formatUploadError(status, body, { rejectSource, rejectCode }) + detail
            );
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
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") throw err;
          lastError = err instanceof Error ? err : new Error(String(err));
          // Network/timeout errors: retry. Formatted 4xx Errors: do not.
          const msg = lastError.message;
          const isClientReject =
            /too large|signed in|not permitted|origin not allowed|Missing file|Invalid|must be an? /i.test(
              msg
            ) ||
            msg.includes("[rejectSource=") ||
            msg.includes("already in progress");
          if (!isClientReject && attempt < retries) {
            await sleep(500 * Math.pow(2, attempt));
            continue;
          }
          throw lastError;
        }
      }

      throw lastError ?? new Error("Upload failed");
    } finally {
      setUploading(false);
      abortRef.current = null;
      inFlightRef.current = false;
    }
  }

  return { upload, uploading, progress, cancel };
}
