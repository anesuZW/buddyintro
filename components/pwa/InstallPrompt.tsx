"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { COPY } from "@/lib/copy";
import { Button } from "@/components/ui/Button";
import { detectPlatform, trackPwaEvent, PWA_ANALYTICS } from "@/lib/pwa/client";
import { getKv, setKv } from "@/lib/pwa/db";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [showIosHint, setShowIosHint] = useState(false);
  const { isIos, isStandalone, isSamsung } = detectPlatform();

  useEffect(() => {
    if (isStandalone) return;

    void getKv<number>(DISMISS_KEY).then((ts) => {
      if (ts && Date.now() - ts < DISMISS_TTL_MS) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    });

    if (isIos) {
      setShowIosHint(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isIos, isStandalone]);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      void trackPwaEvent(PWA_ANALYTICS.INSTALL);
    }
    setDeferred(null);
    await dismiss();
  }

  async function dismiss() {
    setDismissed(true);
    setShowIosHint(false);
    await setKv(DISMISS_KEY, Date.now());
    void trackPwaEvent(PWA_ANALYTICS.INSTALL_DISMISSED);
  }

  if (isStandalone || dismissed) return null;

  if (showIosHint && isIos) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 max-w-lg mx-auto safe-area-pb">
        <div className="card p-4 flex items-start gap-3 shadow-lg border-primary/20 bg-fi-card">
          <Share className="text-primary shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Add BuddyIntro to Home Screen</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tap the Share button, then &ldquo;Add to Home Screen&rdquo; for full-screen access and notifications.
            </p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-lg mx-auto safe-area-pb">
      <div className="card p-4 flex items-start gap-3 shadow-lg border-primary/20 bg-fi-card">
        <Download className="text-primary shrink-0 mt-0.5" size={20} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{COPY.installApp}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {isSamsung ? COPY.installHint : COPY.installHint}
          </p>
          <Button size="sm" className="mt-2" onClick={install}>
            Install
          </Button>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
