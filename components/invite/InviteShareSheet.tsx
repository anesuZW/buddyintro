"use client";

import toast from "react-hot-toast";
import { Copy, MessageCircle, Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { PhoneInviteShare } from "@/types";

export function InviteShareSheet({
  invites,
  open,
  onClose,
}: {
  invites: PhoneInviteShare[];
  open: boolean;
  onClose: () => void;
}) {
  if (!invites.length) return null;

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

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 pt-10">
        <h2 className="text-lg font-bold mb-1">Send invitations</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Share these phone invitations via WhatsApp, SMS, or copy the link.
        </p>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {invites.map((inv) => (
            <div key={inv.inviteToken} className="rounded-2xl border border-border p-4 space-y-3">
              <div className="font-medium text-sm">{inv.phoneNumber}</div>
              <div className="grid grid-cols-2 gap-2">
                {inv.whatsapp && (
                  <a
                    href={inv.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackMethod(inv.inviteToken, "whatsapp")}
                  >
                    <Button variant="outline" className="w-full h-10 text-xs">
                      <MessageCircle size={14} />
                      WhatsApp
                    </Button>
                  </a>
                )}
                {inv.sms && (
                  <a href={inv.sms} onClick={() => trackMethod(inv.inviteToken, "sms")}>
                    <Button variant="outline" className="w-full h-10 text-xs">
                      <Smartphone size={14} />
                      SMS / iMessage
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  className="w-full h-10 text-xs col-span-2"
                  onClick={() => copyLink(inv.inviteLink)}
                >
                  <Copy size={14} />
                  Copy link
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full mt-4" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
