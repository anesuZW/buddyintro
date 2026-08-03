"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import type { NotificationPayload } from "@/types";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { updateAppBadge } from "@/hooks/usePwa";

export function NotificationBell({
  userId,
  initialUnread = 0,
}: {
  userId: string;
  initialUnread?: number;
}) {
  const [open, setOpen] = useState(false);
  const { unread, setUnread, latest, refreshUnread } = useRealtimeNotifications(
    userId,
    initialUnread
  );
  const [items, setItems] = useState<NotificationPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function loadPreview() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=5");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items.slice(0, 5));
        setUnread(data.unreadCount);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (latest) {
      setItems((prev) => {
        if (prev.find((n) => n.id === latest.id)) return prev;
        return [latest, ...prev].slice(0, 5);
      });
    }
  }, [latest]);

  useEffect(() => {
    void updateAppBadge(unread);
  }, [unread]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost h-10 w-10 p-0 relative"
        aria-label="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(70vh,28rem)] overflow-auto rounded-2xl border border-border bg-card shadow-xl z-50">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <span className="font-semibold text-sm">Notifications</span>
            <Link
              href="/notifications"
              className="text-xs font-medium text-primary hover:underline shrink-0"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
          {loading && (
            <div className="px-4 py-5 text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="text-sm font-medium">You’re all caught up</div>
              <p className="text-xs text-muted-foreground mt-1">
                New introductions and messages will show up here.
              </p>
            </div>
          )}
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/70 transition border-b border-border last:border-0"
                  onClick={() => {
                    setOpen(false);
                    void refreshUnread();
                  }}
                >
                  <div className="shrink-0 pt-0.5">
                    {n.actor ? (
                      <Avatar src={n.actor.profilePicture} name={n.actor.name} size="sm" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium leading-snug line-clamp-2">
                        {n.title}
                      </div>
                      {!n.isRead ? (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.message}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5">
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
