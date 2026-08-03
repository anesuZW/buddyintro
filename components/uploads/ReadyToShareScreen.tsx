"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Smartphone, X } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { ReadyToShareState } from "@/lib/upload-manager/types";

export function ReadyToShareScreen({
  state,
  onClose,
}: {
  state: ReadyToShareState;
  onClose: () => void;
}) {
  const [showCheck, setShowCheck] = useState(false);
  const invite = state.phoneInvites[0];

  useEffect(() => {
    const t = window.setTimeout(() => setShowCheck(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  async function trackMethod(token: string, method: "whatsapp" | "sms" | "imessage") {
    try {
      await fetch(`/api/invites/${token}/share-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
    } catch {
      /* ignore */
    }
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied!");
  }

  const relationship = state.relationshipLabel || "a friend";
  const inviter = state.inviterName || "You";

  return (
    <div className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col">
      <div className="flex items-center justify-end p-3">
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-muted"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-10 max-w-lg mx-auto w-full flex flex-col">
        <div className="flex flex-col items-center text-center mb-6">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="h-16 w-16 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-4"
          >
            {showCheck ? <Check size={32} strokeWidth={2.5} /> : null}
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight">Ready to share</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {inviter} introduced them as {relationship}. Send the invitation with one tap —
            their number is already included.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-border bg-card mb-5 aspect-[9/14] max-h-[42vh] relative">
          {state.mediaType === "video" && state.previewUrl ? (
            <video
              src={state.previewUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              autoPlay
              loop
            />
          ) : state.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
              Preview unavailable
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
            <div className="text-sm font-semibold">{relationship}</div>
            {state.recipientLabel ? (
              <div className="text-xs text-white/80 mt-0.5">{state.recipientLabel}</div>
            ) : null}
          </div>
        </div>

        {state.phoneInvites.map((inv) => (
          <div key={inv.inviteToken} className="space-y-2 mb-4">
            <div className="text-sm font-medium">{inv.phoneNumber}</div>
            <div className="grid grid-cols-1 gap-2">
              {inv.whatsapp ? (
                <a
                  href={inv.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackMethod(inv.inviteToken, "whatsapp")}
                >
                  <Button className="w-full h-12" variant="primary">
                    <MessageCircle size={18} />
                    Share to WhatsApp
                  </Button>
                </a>
              ) : null}
              {inv.sms ? (
                <a href={inv.sms} onClick={() => trackMethod(inv.inviteToken, "sms")}>
                  <Button className="w-full h-12" variant="outline">
                    <Smartphone size={18} />
                    Share to SMS / iMessage
                  </Button>
                </a>
              ) : null}
              <Button
                className="w-full h-11"
                variant="ghost"
                onClick={() => copyLink(inv.previewLink || inv.inviteLink)}
              >
                <Copy size={16} />
                Copy invitation link
              </Button>
            </div>
          </div>
        ))}

        {!invite ? (
          <p className="text-sm text-muted-foreground text-center">
            No phone invitations to send for this introduction.
          </p>
        ) : null}

        <Button className="w-full mt-auto" variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
