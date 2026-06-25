"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { COPY } from "@/lib/copy";
import { Button } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("fi-install-dismissed")) setDismissed(true);
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || !deferred) return null;

  async function install() {
    await deferred!.prompt();
    const choice = await deferred!.userChoice;
    if (choice.outcome === "accepted") {
      void fetch("/api/analytics/pwa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "app_installed" }),
      }).catch(() => {});
    }
    setDeferred(null);
    localStorage.setItem("fi-install-dismissed", "1");
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("fi-install-dismissed", "1");
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-lg mx-auto">
      <div className="card p-4 flex items-start gap-3 shadow-lg border-primary/20 bg-fi-card">
        <Download className="text-primary shrink-0 mt-0.5" size={20} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{COPY.installApp}</div>
          <p className="text-xs text-muted-foreground mt-1">{COPY.installHint}</p>
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
