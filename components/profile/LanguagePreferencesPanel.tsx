"use client";

import { useTranslations } from "next-intl";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";

export function LanguagePreferencesPanel() {
  const t = useTranslations("profile");

  return (
    <section className="card p-5 space-y-3">
      <div>
        <h2 className="font-semibold">{t("language")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("languageHint")}</p>
      </div>
      <LanguageSelector />
    </section>
  );
}
