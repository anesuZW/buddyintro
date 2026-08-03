import type { MediaVariantUrls } from "@/lib/storage/types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/constants";
import { oversizeMessage } from "@/lib/media-client-validate";

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
    return body.reason || body.error || oversizeMessage(MAX_UPLOAD_BYTES + 1);
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
    // 100 MB on slower links needs headroom beyond the previous 120s cap.
    xhr.timeout = 300_000;

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
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Check your connection and try again."));
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

export type TransportUploadOptions = {
  kind: UploadKind;
  ext?: string;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  retries?: number;
};

/** Shared XHR upload used by useUpload and the background Upload Manager. */
export async function transportUpload(
  file: Blob | File,
  opts: TransportUploadOptions
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(oversizeMessage(file.size));
  }

  const retries = opts.retries ?? 2;
  const form = new FormData();
  form.append(
    "file",
    file,
    file instanceof File ? file.name : `${opts.kind}.${opts.ext || "bin"}`
  );
  form.append("kind", opts.kind);
  if (opts.ext) form.append("ext", opts.ext);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException("Upload cancelled", "AbortError");
    }

    try {
      const { status, body, rejectSource, rejectCode } = await uploadWithProgress(form, {
        signal: opts.signal,
        onProgress: opts.onProgress,
      });

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

      return {
        url: body.url,
        path: body.path,
        variants: body.variants,
        contentType: body.contentType,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      const isClientReject =
        /too large|supports uploads up to|signed in|not permitted|origin not allowed|Missing file|Invalid|must be an? |isn’t supported|too small|too large \(/i.test(
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
}

export { MAX_UPLOAD_MB };
