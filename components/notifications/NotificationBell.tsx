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
    if (open) loadPreview();
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
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card shadow-xl z-50">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="font-semibold text-sm">Notifications</span>
            <Link
              href="/notifications"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
          {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No notifications yet.</div>
          )}
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="flex gap-3 p-3 hover:bg-muted transition border-b border-border last:border-0"
                  onClick={() => {
                    setOpen(false);
                    void refreshUnread();
                  }}
                >
                  {n.actor && (
                    <Avatar src={n.actor.profilePicture} name={n.actor.name} size="sm" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
