"use client";

import { useEffect } from "react";
import { setAppBadge, trackPwaEvent, PWA_ANALYTICS } from "@/lib/pwa/client";

/** Register periodic sync (Chromium) or visibility-based refresh fallback. */
export function usePeriodicRefresh(onRefresh: () => void) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const registerPeriodic = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        if ("periodicSync" in reg) {
          await (
            reg as ServiceWorkerRegistration & {
              periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
            }
          ).periodicSync.register("buddyintro-refresh", {
            minInterval: 12 * 60 * 60 * 1000,
          });
        }
      } catch {
        /* permission denied or unsupported */
      }
    };

    void registerPeriodic();

    const onVisibility = () => {
      if (document.visibilityState === "visible") onRefresh();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PERIODIC_SYNC") {
        onRefresh();
        void trackPwaEvent(PWA_ANALYTICS.BACKGROUND_SYNC);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [onRefresh]);
}

export async function updateAppBadge(count: number) {
  await setAppBadge(count);
}
