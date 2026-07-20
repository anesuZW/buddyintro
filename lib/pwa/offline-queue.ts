"use client";

import { listQueuedUploads, queueUpload, removeQueuedUpload } from "@/lib/pwa/db";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBlob(base64: string, contentType: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: contentType });
}

export async function enqueueOfflineRequest(url: string, init: RequestInit = {}) {
  const method = init.method ?? "POST";
  let bodyBase64 = "";
  const headers: Record<string, string> = {};

  if (init.headers) {
    const h = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
    h.forEach((v, k) => {
      headers[k] = v;
    });
  }

  if (init.body) {
    if (typeof init.body === "string") {
      bodyBase64 = btoa(unescape(encodeURIComponent(init.body)));
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    } else if (init.body instanceof Blob) {
      bodyBase64 = arrayBufferToBase64(await init.body.arrayBuffer());
      headers["Content-Type"] = headers["Content-Type"] ?? (init.body.type || "application/octet-stream");
    }
  }

  const entry = await queueUpload({ url, method, headers, bodyBase64 });
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const reg = await navigator.serviceWorker.ready;
    const syncReg = reg as ServiceWorkerRegistration & {
      sync: { register: (tag: string) => Promise<void> };
    };
    await syncReg.sync.register("buddyintro-offline-queue").catch(() => {});
  }
  return entry;
}

export async function flushOfflineQueue() {
  if (!navigator.onLine) return { flushed: 0, failed: 0 };

  const entries = await listQueuedUploads();
  let flushed = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      let body: BodyInit | undefined;
      const contentType = entry.headers["Content-Type"] || entry.headers["content-type"];
      if (entry.bodyBase64) {
        if (contentType?.includes("json") || contentType?.includes("text")) {
          body = decodeURIComponent(escape(atob(entry.bodyBase64)));
        } else {
          body = base64ToBlob(entry.bodyBase64, contentType || "application/octet-stream");
        }
      }

      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body,
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await removeQueuedUpload(entry.id);
      flushed++;
    } catch {
      failed++;
    }
  }

  return { flushed, failed };
}

export function registerOfflineQueueFlush() {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => {
    void flushOfflineQueue();
  };

  window.addEventListener("online", onOnline);

  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === "BACKGROUND_SYNC") {
      void flushOfflineQueue();
    }
  };

  navigator.serviceWorker?.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("online", onOnline);
    navigator.serviceWorker?.removeEventListener("message", onMessage);
  };
}
