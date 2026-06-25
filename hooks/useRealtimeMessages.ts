"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

type DbMessage = Database["public"]["Tables"]["messages"]["Row"];

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

    async function load() {
      if (initialMessages?.length) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (!mounted) return;
      if (!error && data) setMessages(data);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`messages:${userId}:${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as DbMessage;
          const isThisChat =
            (m.sender_id === userId && m.receiver_id === otherUserId) ||
            (m.sender_id === otherUserId && m.receiver_id === userId);
          if (!isThisChat) return;
          setMessages((prev) => {
            if (prev.find((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId, otherUserId, initialMessages?.length]);

  return { messages, loading, setMessages };
}
