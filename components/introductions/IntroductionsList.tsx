"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { IntroductionCard } from "./IntroductionCard";
import type { IntroductionItem } from "@/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ListError, ListLoading } from "@/components/ui/ListState";

type Tab = "recent" | "past" | "pending";
type Category = { id: string; name: string };

export function IntroductionsList({
  initialCategories,
}: {
  /** SSR-passed categories skip client /api/introduction-categories fetch. */
  initialCategories?: Category[];
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>(initialCategories ?? []);
  const [neverExpire, setNeverExpire] = useState(false);
  const [items, setItems] = useState<IntroductionItem[]>([]);
  const [counts, setCounts] = useState<Record<Tab, number>>({ recent: 0, past: 0, pending: 0 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markedSeen, setMarkedSeen] = useState(false);

  const loadTab = useCallback(
    async (group: Tab, append = false, nextCursor?: string | null) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams({ group });
        if (append && nextCursor) params.set("cursor", nextCursor);
        const res = await fetch(`/api/introductions?${params}`);
        if (!res.ok) throw new Error("Could not load introductions");
        const json = await res.json();
        setItems((prev) => (append ? [...prev, ...json.items] : json.items));
        setCursor(json.nextCursor);
        setNeverExpire(Boolean(json.neverExpire));
        if (json.counts) setCounts(json.counts);

        if (!markedSeen && !append) {
          await fetch("/api/introductions", { method: "POST" });
          setMarkedSeen(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load introductions");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [markedSeen]
  );

  useEffect(() => {
    if (initialCategories?.length) return;
    fetch("/api/introduction-categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCategories(data?.categories ?? []));
  }, [initialCategories]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    loadTab(tab, false);
  }, [tab, loadTab]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "recent", label: "Recent", count: counts.recent },
    { id: "past", label: "Past", count: counts.past },
    { id: "pending", label: "Pending", count: counts.pending },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter && item.introductionCategoryId !== categoryFilter) return false;
      if (!q) return true;
      const author = item.user.name.toLowerCase();
      const caption = (item.text ?? "").toLowerCase();
      const tagNames = item.tags
        .map((t) => t.taggedUser?.name ?? "")
        .join(" ")
        .toLowerCase();
      const categoryName = item.category?.name?.toLowerCase() ?? "";
      return (
        author.includes(q) ||
        caption.includes(q) ||
        tagNames.includes(q) ||
        categoryName.includes(q)
      );
    });
  }, [items, query, categoryFilter]);

  if (loading && !items.length) {
    return (
      <div className="px-4 py-12">
        <ListLoading label="Loading introductions…" />
      </div>
    );
  }

  return (
    <div id="introductions-list">
      {error && !items.length && (
        <div className="px-4">
          <ListError message={error} onRetry={() => loadTab(tab, false)} />
        </div>
      )}

      {neverExpire && (
        <p className="mx-4 mt-3 text-xs text-muted-foreground bg-fi-card border border-border rounded-xl px-3 py-2">
          Introductions never expire — your full introduction history stays searchable.
        </p>
      )}

      <div className="px-4 pt-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search introductions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition",
            !categoryFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          All
        </button>
        {categories.slice(0, 8).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryFilter(c.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition",
              categoryFilter === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4 pb-6">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No {tab} introductions yet.
          </p>
        ) : (
          filtered.map((item) => <IntroductionCard key={item.id} item={item} />)
        )}
        {cursor && (
          <Button
            variant="outline"
            className="w-full"
            disabled={loadingMore}
            onClick={() => loadTab(tab, true, cursor)}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}
