"use client";

import { useCallback, useEffect, useState } from "react";
import { ConversationList } from "@/components/messages/ConversationList";
import { ListEmpty, ListError, ListLoading } from "@/components/ui/ListState";
import { Button } from "@/components/ui/Button";
import type { ConversationSummary } from "@/types";

export function MessagesInboxClient() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (append = false, nextCursor?: string | null) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const url = nextCursor
        ? `/api/messages?cursor=${encodeURIComponent(nextCursor)}`
        : "/api/messages";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load conversations");
      const data = await res.json();
      setConversations((prev) => (append ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load conversations");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) return <ListLoading label="Loading conversations…" />;
  if (error && !conversations.length) {
    return <ListError message={error} onRetry={() => load(false)} />;
  }

  return (
    <div>
      {error && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}
      {!conversations.length ? (
        <ListEmpty message="No conversations yet. Message someone from an introduction to start chatting." />
      ) : (
        <ConversationList conversations={conversations} />
      )}
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
