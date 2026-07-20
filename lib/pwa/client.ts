"use client";

import { PWA_ANALYTICS } from "@/lib/pwa/analytics";

export { PWA_ANALYTICS } from "@/lib/pwa/analytics";

export async function trackPwaEvent(
  event: (typeof PWA_ANALYTICS)[keyof typeof PWA_ANALYTICS],
  metadata?: Record<string, unknown>
) {
  try {
    await fetch("/api/analytics/pwa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata }),
      keepalive: true,
    });
  } catch {
    /* non-blocking */
  }
}

export function detectPlatform(): {
  isIos: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  isSamsung: boolean;
} {
  if (typeof navigator === "undefined") {
    return { isIos: false, isAndroid: false, isStandalone: false, isSamsung: false };
  }
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return { isIos, isAndroid, isStandalone, isSamsung };
}

export async function setAppBadge(count: number) {
  if ("setAppBadge" in navigator) {
    try {
      if (count > 0) {
        await (
          navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }
        ).setAppBadge(count);
      } else {
        await (
          navigator as Navigator & { clearAppBadge?: () => Promise<void> }
        ).clearAppBadge?.();
      }
    } catch {
      /* unsupported or denied */
    }
  }
}

export function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function parseDeviceMeta() {
  if (typeof navigator === "undefined") return {};
  const ua = navigator.userAgent;
  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "edge";
  else if (/Chrome\//.test(ua)) browser = "chrome";
  else if (/Firefox\//.test(ua)) browser = "firefox";
  else if (/Safari\//.test(ua)) browser = "safari";
  else if (/SamsungBrowser/.test(ua)) browser = "samsung";

  let deviceType = "desktop";
  if (/Mobi|Android/i.test(ua)) deviceType = "mobile";
  else if (/Tablet|iPad/i.test(ua)) deviceType = "tablet";

  return {
    browser,
    deviceType,
    platform: navigator.platform || "unknown",
  };
}

/** Resolve locale-prefixed path for SW notification deep links. */
export function resolveNotificationUrl(url: string): string {
  if (typeof window === "undefined") return url;
  if (!url.startsWith("/")) return url;

  const segment = window.location.pathname.split("/")[1];
  const localePattern = /^(en|es|pt|fr|de|hi|ar|zh|ja|ko)$/;
  const locale = localePattern.test(segment) ? segment : "en";

  if (url.startsWith(`/${locale}/`) || localePattern.test(url.slice(1).split("/")[0] ?? "")) {
    return url;
  }
  return `/${locale}${url}`;
}
