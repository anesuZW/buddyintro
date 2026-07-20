"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { trackPwaEvent, PWA_ANALYTICS } from "@/lib/pwa/client";

export function OfflineDetector() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();

    const onOffline = () => {
      setOffline(true);
      void trackPwaEvent(PWA_ANALYTICS.OFFLINE);
    };
    const onOnline = () => {
      setOffline(false);
      void trackPwaEvent(PWA_ANALYTICS.ONLINE);
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 text-amber-950 px-4 py-2 text-xs font-medium shadow-lg">
        <WifiOff size={14} />
        You&apos;re offline — changes will sync when reconnected
      </div>
    </div>
  );
}
