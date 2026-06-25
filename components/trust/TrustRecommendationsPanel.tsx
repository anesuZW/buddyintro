"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Network } from "lucide-react";
import type { TrustRecommendation } from "@/services/trust-recommendations";

// Module-level dedupe — prevents 4× fetch when navigating between pages in same session.
let recommendationsCache: Promise<TrustRecommendation[] | null> | null = null;
let cachedRecommendations: TrustRecommendation[] | null = null;

function loadRecommendations(): Promise<TrustRecommendation[] | null> {
  if (cachedRecommendations) return Promise.resolve(cachedRecommendations);
  if (!recommendationsCache) {
    recommendationsCache = fetch("/api/trust/recommendations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const recs = (data?.recommendations ?? []) as TrustRecommendation[];
        cachedRecommendations = recs;
        return recs;
      })
      .catch(() => null);
  }
  return recommendationsCache;
}

/** Seed client cache from SSR to skip redundant API round-trip. */
export function seedTrustRecommendationsCache(recs: TrustRecommendation[]) {
  cachedRecommendations = recs;
}

export function TrustRecommendationsPanel({
  title = "Trust recommendations",
  limit = 4,
  initialRecommendations,
}: {
  title?: string;
  limit?: number;
  /** When provided from SSR, skips client fetch entirely. */
  initialRecommendations?: TrustRecommendation[];
}) {
  const [items, setItems] = useState<TrustRecommendation[]>(
    () => (initialRecommendations ?? cachedRecommendations ?? []).slice(0, limit)
  );
  const [loading, setLoading] = useState(
    initialRecommendations === undefined && !cachedRecommendations
  );

  useEffect(() => {
    if (initialRecommendations !== undefined) {
      seedTrustRecommendationsCache(initialRecommendations);
      setItems(initialRecommendations.slice(0, limit));
      setLoading(false);
      return;
    }
    loadRecommendations()
      .then((recs) => setItems((recs ?? []).slice(0, limit)))
      .finally(() => setLoading(false));
  }, [limit, initialRecommendations]);

  if (loading || !items.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Network size={16} className="text-primary" />
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition"
          >
            <div className="text-xs font-medium text-primary">{item.title}</div>
            <p className="text-sm text-foreground mt-1">{item.message}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
