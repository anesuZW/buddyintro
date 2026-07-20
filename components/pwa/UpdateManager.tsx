"use client";

import { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useServiceWorker } from "@/components/pwa/ServiceWorkerProvider";
import { trackPwaEvent, PWA_ANALYTICS } from "@/lib/pwa/client";
import { getKv, setKv } from "@/lib/pwa/db";

export function UpdateManager() {
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void getKv<boolean>("update-banner-dismissed").then((v) => {
      if (v) setDismissed(true);
    });
  }, []);

  if (!updateAvailable || dismissed) return null;

  async function dismiss() {
    setDismissed(true);
    await setKv("update-banner-dismissed", true);
    void trackPwaEvent(PWA_ANALYTICS.UPDATE_DISMISSED);
  }

  return (
    <div
      className="fixed top-16 left-4 right-4 z-50 max-w-lg mx-auto"
      role="status"
      aria-live="polite"
    >
      <div className="card p-4 flex items-start gap-3 shadow-lg border-primary/30 bg-fi-card">
        <RefreshCw className="text-primary shrink-0 mt-0.5" size={18} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">A new version of BuddyIntro is available</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={applyUpdate}>
              Update
            </Button>
            <Button size="sm" variant="outline" onClick={dismiss}>
              Later
            </Button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss update notice">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
