"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

type DbMessage = Database["public"]["Tables"]["messages"]["Row"];

function sameChatMessage(
  m: DbMessage,
  userId: string,
  otherUserId: string
): boolean {
  return (
    (m.sender_id === userId && m.receiver_id === otherUserId) ||
    (m.sender_id === otherUserId && m.receiver_id === userId)
  );
}

function mergeIncoming(prev: DbMessage[], incoming: DbMessage): DbMessage[] {
  if (prev.some((x) => x.id === incoming.id)) return prev;
  // Replace optimistic tmp bubble with the realtime/server row.
  const tmpIdx = prev.findIndex(
    (x) =>
      x.id.startsWith("tmp-") &&
      x.sender_id === incoming.sender_id &&
      x.message === incoming.message
  );
  if (tmpIdx >= 0) {
    const next = [...prev];
    next[tmpIdx] = incoming;
    return next;
  }
  return [...prev, incoming];
}

/**
 * Subscribe to messages between `userId` and `otherUserId`.
 * Pass `initialMessages` from SSR to skip the duplicate full-thread fetch.
 */
export function useRealtimeMessages(
  userId: string,
  otherUserId: string,
  initialMessages?: DbMessage[]
) {
  const [messages, setMessages] = useState<DbMessage[]>(initialMessages ?? []);
  const [loading, setLoading] = useState(!initialMessages?.length);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    // Always reset to the SSR snapshot for this peer (prevents chat bleed on soft nav).
    setMessages(initialMessages ?? []);
    setLoading(!initialMessages?.length);

    async function load() {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (!mounted) return;
      if (!error && data) {
        setMessages((prev) => {
          const temps = prev.filter((m) => m.id.startsWith("tmp-"));
          const map = new Map<string, DbMessage>();
          for (const m of data) map.set(m.id, m);
          for (const t of temps) {
            const replaced = data.some(
              (m) => m.sender_id === t.sender_id && m.message === t.message
            );
            if (!replaced) map.set(t.id, t);
          }
          return Array.from(map.values()).sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      }
      setLoading(false);
    }

    // If SSR gave us a page, still allow reconnect backfill via subscribe callback.
    if (!initialMessages?.length) {
      void load();
    } else {
      setLoading(false);
    }

    const channel = supabase
      .channel(`messages:${userId}:${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as DbMessage;
          if (!sameChatMessage(m, userId, otherUserId)) return;
          setMessages((prev) => mergeIncoming(prev, m));
          // Mark inbound as read while this chat is open.
          if (m.sender_id === otherUserId && m.receiver_id === userId) {
            void fetch("/api/messages/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ otherUserId }),
            }).catch(() => {});
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void load();
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // initialMessages identity changes every SSR; length + peer ids are enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, otherUserId, initialMessages?.length]);

  return { messages, loading, setMessages };
}
