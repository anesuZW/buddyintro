"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/branding";
import type { WelcomeCardDisplay } from "@/lib/multi-invite-welcome";

function isStoryViewerPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Activation story opens at /stories/[userId] or /stories/view/[storyId].
  // Do not cover that experience — show after the user leaves the player.
  return /\/stories\/[^/]+/.test(pathname);
}

export function MultiInviteWelcomeCard({
  payload,
}: {
  payload: WelcomeCardDisplay;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dismissedRef = useRef(false);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (dismissedRef.current) return;
    if (isStoryViewerPath(pathname)) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [pathname]);

  async function dismiss() {
    if (dismissingRef.current || dismissedRef.current) return;
    dismissingRef.current = true;
    dismissedRef.current = true;
    setOpen(false);
    try {
      await fetch("/api/invites/welcome-card", { method: "POST" });
    } catch {
      // Stay dismissed in this session; pending flag may clear on next successful POST.
    } finally {
      dismissingRef.current = false;
    }
  }

  const { totalCount, activationInviterName, otherInviterNames, moreCount } =
    payload;

  return (
    <Modal open={open} onClose={() => void dismiss()}>
      <div className="p-6 pt-10 space-y-4">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            Welcome to {BRAND.name}! 🎉
          </h2>
          <p className="text-muted-foreground">
            {totalCount} friends invited you to join.
          </p>
        </div>

        <p className="text-sm text-center">
          <span className="font-medium text-foreground">
            {activationInviterName}
          </span>{" "}
          introduced you to this story.
        </p>

        {otherInviterNames.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              You&apos;ll also find introductions waiting from:
            </p>
            <ul className="space-y-1 text-sm font-medium">
              {otherInviterNames.map((name, i) => (
                <li key={`${name}-${i}`}>• {name}</li>
              ))}
              {moreCount > 0 && (
                <li className="text-muted-foreground">+{moreCount} more</li>
              )}
            </ul>
          </div>
        )}

        <p className="text-sm text-center text-muted-foreground">
          Start with {activationInviterName}&apos;s introduction whenever
          you&apos;re ready.
        </p>

        <Button className="w-full" onClick={() => void dismiss()}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}
