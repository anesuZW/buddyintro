"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

type Prefs = "all" | "essential" | "custom";

const STORAGE_KEY = "fi_cookie_consent";

export function CookieConsentBanner() {
  const t = useTranslations("cookies");
  const tLegal = useTranslations("legal");
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
    <div className="fixed bottom-20 inset-x-0 z-40 px-4 md:bottom-4">
      <div className="max-w-2xl mx-auto card p-4 shadow-xl border border-border">
        <p className="text-sm font-semibold">{t("title")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("description")}{" "}
          <Link href="/cookies" className="text-primary underline">
            {tLegal("cookies")}
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
            {t("analytics")}
          </label>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <Button className="h-9 text-xs" onClick={() => save("all")}>
            {t("acceptAll")}
          </Button>
          <Button variant="outline" className="h-9 text-xs" onClick={() => save("essential")}>
            {t("rejectNonEssential")}
          </Button>
          {!showCustomize ? (
            <Button variant="ghost" className="h-9 text-xs" onClick={() => setShowCustomize(true)}>
              {t("customize")}
            </Button>
          ) : (
            <Button variant="ghost" className="h-9 text-xs" onClick={() => save("custom")}>
              {t("savePreferences")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
