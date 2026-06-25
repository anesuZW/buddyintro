"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/utils";
import type { NotificationPayload } from "@/types";
import { ListError, ListLoading } from "@/components/ui/ListState";

const FILTERS = [
  { id: "", label: "All" },
  { id: "introduction_received", label: "Introductions" },
  { id: "message_received", label: "Messages" },
  { id: "discovery_liked", label: "Discoveries" },
  { id: "trust_score_increased", label: "Trust" },
];

export function NotificationsPageClient() {
  const [items, setItems] = useState<NotificationPayload[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (append = false, nextCursor?: string | null) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams();
        if (filter) params.set("type", filter);
        if (append && nextCursor) params.set("cursor", nextCursor);
        const res = await fetch(`/api/notifications?${params}`);
        if (!res.ok) throw new Error("Could not load notifications");
        const data = await res.json();
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load notifications");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function remove(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <ListLoading label="Loading notifications…" />}

      {error && !items.length && (
        <ListError message={error} onRetry={() => load(false)} />
      )}

      {error && items.length > 0 && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}

      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="card p-3 flex gap-3">
            {n.actor && <Avatar src={n.actor.profilePicture} name={n.actor.name} size="md" />}
            <div className="flex-1 min-w-0">
              <Link href={n.href} className="block hover:opacity-80" onClick={() => !n.isRead && markRead(n.id)}>
                <div className="font-medium text-sm">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</div>
              </Link>
              <div className="flex gap-2 mt-2">
                {!n.isRead && (
                  <button type="button" className="text-[10px] text-primary" onClick={() => markRead(n.id)}>
                    Mark read
                  </button>
                )}
                <button type="button" className="text-[10px] text-muted-foreground" onClick={() => remove(n.id)}>
                  Delete
                </button>
              </div>
            </div>
            {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
          </li>
        ))}
      </ul>

      {cursor && (
        <Button
          variant="outline"
          className="w-full mt-4"
          disabled={loadingMore}
          onClick={() => load(true, cursor)}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
