"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { InviteOnboardingHydrator } from "@/components/invite/InviteOnboardingShell";
import { BRAND } from "@/lib/branding";
import { useInviteOnboarding } from "@/stores/invite-onboarding";

export function InviteLandingClient({
  inviteToken,
  inviterName,
  inviterAvatar,
  email,
  phoneNumber,
  previewUrl,
}: {
  inviteToken: string;
  inviterName: string;
  inviterAvatar: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  previewUrl: string;
}) {
  const router = useRouter();
  const setInvite = useInviteOnboarding((s) => s.setInvite);

  useEffect(() => {
    setInvite({
      token: inviteToken,
      email: email ?? "",
      inviterName,
      inviterAvatar,
    });
  }, [inviteToken, email, inviterName, inviterAvatar, setInvite]);

  const invitedAs = email || phoneNumber;

  return (
    <>
      <InviteOnboardingHydrator tokenFromServer={inviteToken} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 max-w-md w-full text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
        <div className="relative">
          <Avatar src={inviterAvatar} name={inviterName} size="xl" ring className="mx-auto" />
          <h1 className="mt-4 text-2xl font-bold">
            {inviterName} introduced you on {BRAND.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Preview the introduction they made for you, then join in seconds.
          </p>
          {invitedAs && (
            <p className="mt-3 text-sm text-muted-foreground">
              Invited as <span className="font-medium text-foreground">{invitedAs}</span>
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link href={previewUrl}>
              <Button className="w-full h-12">Preview introduction</Button>
            </Link>
            <Button
              className="w-full h-12"
              variant="outline"
              onClick={() => router.push(`/signup?invite=${inviteToken}`)}
            >
              Accept invite & sign up
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
