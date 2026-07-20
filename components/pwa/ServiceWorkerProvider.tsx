"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { trackPwaEvent, PWA_ANALYTICS, resolveNotificationUrl } from "@/lib/pwa/client";
import { registerOfflineQueueFlush } from "@/lib/pwa/offline-queue";

type SwContextValue = {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  applyUpdate: () => void;
};

const SwContext = createContext<SwContextValue>({
  registration: null,
  updateAvailable: false,
  applyUpdate: () => {},
});

export function useServiceWorker() {
  return useContext(SwContext);
}

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorker = useRef<ServiceWorker | null>(null);

  const applyUpdate = useCallback(() => {
    const worker = waitingWorker.current;
    if (!worker) return;
    worker.postMessage({ type: "SKIP_WAITING" });
    void trackPwaEvent(PWA_ANALYTICS.UPDATE_INSTALLED);
    window.location.reload();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (!mounted) return;
        setRegistration(reg);

        if (reg.waiting) {
          waitingWorker.current = reg.waiting;
          setUpdateAvailable(true);
        }

        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker.current = reg.waiting;
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {});

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const cleanupQueue = registerOfflineQueueFlush();

    const onMessage = (event: MessageEvent) => {
      const { type, url, action, tag } = event.data ?? {};
      if (type === "NOTIFICATION_CLICK") {
        void trackPwaEvent(PWA_ANALYTICS.NOTIFICATION_CLICKED, { url, action });
        window.location.assign(resolveNotificationUrl(url || "/notifications"));
      }
      if (type === "NOTIFICATION_CLOSE") {
        void trackPwaEvent(PWA_ANALYTICS.NOTIFICATION_DISMISSED, { tag });
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      cleanupQueue();
    };
  }, []);

  return (
    <SwContext.Provider value={{ registration, updateAvailable, applyUpdate }}>
      {children}
    </SwContext.Provider>
  );
}
