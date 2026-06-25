"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { NotificationPayload } from "@/types";
import { notificationHref } from "@/lib/notification-types";

type DbNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

function mapRow(row: DbNotification): NotificationPayload {
  return {
    id: row.id,
    userId: row.user_id,
    actorId: row.actor_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
    href: notificationHref(row.entity_type, row.entity_id, row.actor_id),
  };
}

/** Live unread count + optional preview refresh via Supabase Realtime. */
export function useRealtimeNotifications(userId: string, initialUnread = 0) {
  const [unread, setUnread] = useState(initialUnread);
  const [latest, setLatest] = useState<NotificationPayload | null>(null);

  const refreshUnread = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=1");
    if (!res.ok) return;
    const data = await res.json();
    setUnread(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DbNotification;
          setLatest(mapRow(row));
          if (!row.is_read) setUnread((n) => n + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DbNotification;
          if (row.is_read) {
            setUnread((n) => Math.max(0, n - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshUnread]);

  return { unread, setUnread, latest, refreshUnread };
}
