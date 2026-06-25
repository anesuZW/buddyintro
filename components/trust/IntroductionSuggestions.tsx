"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { COPY } from "@/lib/copy";
import type { IntroductionSuggestionPayload } from "@/types";

export function IntroductionSuggestions({
  suggestions,
}: {
  suggestions: IntroductionSuggestionPayload[];
}) {
  if (!suggestions.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Sparkles size={16} className="text-accent-gold" />
        {COPY.suggestedIntroductions}
      </h2>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <p className="text-sm text-foreground">{s.message}</p>
            <p className="text-xs text-muted-foreground">{s.reason}</p>
            <Link
              href="/create-story"
              className="inline-block text-xs font-medium text-primary hover:underline"
            >
              Create introduction →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
