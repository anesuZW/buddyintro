"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  contentType?: "story" | "introduction" | "comment" | "message" | "caption" | "transcription";
};

/** Placeholder for future AI translation — no translation performed yet. */
export function TranslateAction({ className, contentType = "story" }: Props) {
  const t = useTranslations("ugc");

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition",
        className
      )}
      aria-label={`${t("translate")} ${contentType}`}
      onClick={() => {
        /* AI translation hook point */
      }}
    >
      <Languages size={14} />
      {t("translate")}
    </button>
  );
}
