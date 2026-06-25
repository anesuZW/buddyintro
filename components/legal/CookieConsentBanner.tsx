"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/branding";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

type Prefs = "all" | "essential" | "custom";

const STORAGE_KEY = "fi_cookie_consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function save(prefs: Prefs) {
    const payload = {
      preference: prefs,
      analytics: prefs === "all" ? true : prefs === "essential" ? false : analytics,
      version: LEGAL_VERSIONS.cookies,
      at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 md:bottom-4">
      <div className="max-w-2xl mx-auto card p-4 shadow-xl border border-border">
        <p className="text-sm font-semibold">Cookie preferences</p>
        <p className="text-xs text-muted-foreground mt-1">
          We use essential cookies for authentication. Optional analytics cookies help us
          improve {BRAND.name}. See our{" "}
          <Link href="/cookies" className="text-primary underline">
            Cookie Policy
          </Link>
          .
        </p>

        {showCustomize && (
          <label className="flex items-center gap-2 mt-3 text-sm">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
            />
            Analytics cookies (non-essential)
          </label>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <Button className="h-9 text-xs" onClick={() => save("all")}>
            Accept all
          </Button>
          <Button variant="outline" className="h-9 text-xs" onClick={() => save("essential")}>
            Reject non-essential
          </Button>
          {!showCustomize ? (
            <Button variant="ghost" className="h-9 text-xs" onClick={() => setShowCustomize(true)}>
              Customize
            </Button>
          ) : (
            <Button variant="ghost" className="h-9 text-xs" onClick={() => save("custom")}>
              Save preferences
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
