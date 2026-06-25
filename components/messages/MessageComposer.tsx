"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

export function MessageComposer({
  currentUserId,
  otherUserId,
  storyReference,
  storyContext,
  discoveriesPostReference,
  conversationOrigin = "direct",
  onSent,
}: {
  currentUserId: string;
  otherUserId: string;
  storyReference?: string | null;
  storyContext?: { id: string; mediaUrl: string; mediaType: string } | null;
  discoveriesPostReference?: string | null;
  conversationOrigin?: "story" | "discoveries" | "direct";
  onSent?: (message: any) => void;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [includeStory, setIncludeStory] = useState(true);
  const [includeContext, setIncludeContext] = useState(true);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSending(true);
    try {
      const origin = includeContext ? conversationOrigin : "direct";
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: otherUserId,
          message: value,
          storyReference:
            includeStory && includeContext && origin === "story" ? storyReference : null,
          discoveriesPostReference:
            includeContext && origin === "discoveries" ? discoveriesPostReference : null,
          conversationOrigin: origin,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send");
      }
      const data = await res.json();
      onSent?.({
        id: data.message.id,
        sender_id: currentUserId,
        receiver_id: otherUserId,
        message: value,
        story_reference:
          includeStory && includeContext && origin === "story" ? storyReference ?? null : null,
        created_at: new Date().toISOString(),
        read_at: null,
      });
      setValue("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-border p-3 space-y-2 shrink-0">
      {storyContext && includeStory && conversationOrigin === "story" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="rounded-md overflow-hidden h-10 w-10 bg-black flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={storyContext.mediaUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1">Replying to a story</div>
          <button
            type="button"
            onClick={() => setIncludeStory(false)}
            className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Remove reply"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {conversationOrigin === "discoveries" && discoveriesPostReference && includeContext && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1">Conversation started from Discoveries</div>
          <button
            type="button"
            onClick={() => setIncludeContext(false)}
            className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Remove context"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <form onSubmit={send} className="flex items-center gap-2">
        <input
          className="flex-1 h-11 px-4 rounded-full bg-muted outline-none text-sm focus:ring-2 focus:ring-primary/30"
          placeholder="Send a message…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button size="icon" disabled={sending || !value.trim()}>
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}
