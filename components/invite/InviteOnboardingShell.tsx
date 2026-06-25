"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/branding";
import { useInviteOnboarding } from "@/stores/invite-onboarding";

/** Syncs invite token from URL/cookies into persisted onboarding state. */
export function InviteOnboardingHydrator({ tokenFromServer }: { tokenFromServer?: string }) {
  const params = useSearchParams();
  const setInvite = useInviteOnboarding((s) => s.setInvite);
  const storedToken = useInviteOnboarding((s) => s.token);

  const token = params.get("invite") || tokenFromServer || storedToken;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/invites/${token}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setInvite({
          token: data.inviteToken,
          email: data.email,
          inviterName: data.inviter?.name,
          inviterAvatar: data.inviter?.profilePicture,
          storyMediaUrl: data.story?.mediaUrl,
          storyMediaType: data.story?.mediaType,
          storyCaption: data.story?.text,
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, setInvite]);

  return null;
}

export function InviteSignupBackground() {
  const storyMediaUrl = useInviteOnboarding((s) => s.storyMediaUrl);
  const storyMediaType = useInviteOnboarding((s) => s.storyMediaType);
  const inviterName = useInviteOnboarding((s) => s.inviterName);

  if (!storyMediaUrl) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {storyMediaType === "video" ? (
        <video
          src={storyMediaUrl}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover opacity-30 blur-sm scale-105"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={storyMediaUrl}
          alt=""
          className="h-full w-full object-cover opacity-25 blur-sm scale-105"
        />
      )}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
      {inviterName && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-6 left-0 right-0 text-center text-sm text-muted-foreground"
        >
          You were invited to {BRAND.name} by {inviterName}
        </motion.p>
      )}
    </div>
  );
}
