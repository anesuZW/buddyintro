"use client";

import { localeLabels, locales, type AppLocale } from "@/i18n/routing";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function LanguageSelector({ className, compact = false }: Props) {
  const { locale, switchLocale, isSwitching } = useLanguage();

  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {!compact && (
        <span className="text-sm font-medium text-foreground">
          {localeLabels[locale]}
        </span>
      )}
      <select
        aria-label="Language"
        className={cn(
          "rounded-xl border border-border bg-card px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/40",
          isSwitching && "opacity-60"
        )}
        value={locale}
        disabled={isSwitching}
        onChange={(event) => switchLocale(event.target.value as AppLocale)}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
