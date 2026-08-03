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

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition ${
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

      {!loading && !error && items.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-sm font-semibold">No notifications yet</div>
          <p className="text-xs text-muted-foreground mt-1">
            When friends introduce you or message you, it will show up here.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="card px-3.5 py-3.5 flex items-start gap-3">
            <div className="shrink-0 pt-0.5">
              {n.actor ? (
                <Avatar src={n.actor.profilePicture} name={n.actor.name} size="md" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={n.href}
                className="block hover:opacity-80"
                onClick={() => !n.isRead && markRead(n.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm leading-snug">{n.title}</div>
                  {!n.isRead ? (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {n.message}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1.5">
                  {timeAgo(n.createdAt)}
                </div>
              </Link>
              <div className="flex gap-3 mt-2.5">
                {!n.isRead && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary"
                    onClick={() => markRead(n.id)}
                  >
                    Mark read
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground"
                  onClick={() => remove(n.id)}
                >
                  Delete
                </button>
              </div>
            </div>
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
