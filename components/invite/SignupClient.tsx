"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { appUrl } from "@/lib/utils";
import { COPY } from "@/lib/copy";
import { BRAND } from "@/lib/branding";
import {
  InviteOnboardingHydrator,
  InviteSignupBackground,
} from "@/components/invite/InviteOnboardingShell";
import { SignupConsentFields } from "@/components/legal/SignupConsentFields";
import { useInviteOnboarding } from "@/stores/invite-onboarding";

export function SignupClient({
  initialToken,
  initialEmail,
}: {
  initialToken?: string;
  initialEmail?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlToken = params.get("invite") || undefined;

  const stored = useInviteOnboarding();
  const inviteToken = urlToken || initialToken || stored.token || undefined;
  const invitedEmail = stored.email || initialEmail || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailLocked, setEmailLocked] = useState(Boolean(initialEmail));
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ready, setReady] = useState(!inviteToken);

  useEffect(() => {
    if (invitedEmail) {
      setEmail(invitedEmail);
      setEmailLocked(true);
      setReady(true);
    }
  }, [invitedEmail]);

  useEffect(() => {
    if (!inviteToken) {
      setReady(true);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), 800);
    return () => window.clearTimeout(timer);
  }, [inviteToken]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Please accept the Terms and Privacy Policy.");
      return;
    }
    if (
      inviteToken &&
      invitedEmail &&
      email.toLowerCase() !== invitedEmail.toLowerCase()
    ) {
      toast.error("Please sign up with the invited email address.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, invite_token: inviteToken },
          emailRedirectTo: appUrl(
            `/auth/callback?next=/home${inviteToken ? `&invite=${inviteToken}` : ""}`
          ),
        },
      });
      if (error) throw error;

      if (data.session) {
        const res = await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, inviteToken, acceptedTerms: true }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Bootstrap failed");

        await fetch("/api/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        stored.clearInvite();
        toast.success(`Welcome to ${BRAND.name}!`);
        router.replace(payload.redirectTo || "/home");
      } else {
        toast.success("Check your email to confirm your account.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready && inviteToken) {
    return (
      <div className="card p-8 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="mt-6 space-y-4">
          <div className="h-12 bg-muted rounded-2xl" />
          <div className="h-12 bg-muted rounded-2xl" />
          <div className="h-12 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <InviteOnboardingHydrator tokenFromServer={inviteToken} />
      <InviteSignupBackground />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 relative overflow-hidden"
      >
        {stored.inviterName && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
            <Avatar
              src={stored.inviterAvatar}
              name={stored.inviterName}
              size="md"
              ring
            />
            <div>
              <p className="text-sm font-semibold">{stored.inviterName}</p>
              <p className="text-xs text-muted-foreground">invited you</p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold">
          {inviteToken ? `You were invited to ${BRAND.name}` : COPY.startTrustedNetwork}
        </h1>
        <p className="text-muted-foreground mt-1">
          {inviteToken
            ? "Finish signing up to view your introduction and build trusted connections."
            : COPY.discoverThroughIntros}
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <Input
            placeholder="Display name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="space-y-1">
            <Input
              type="email"
              placeholder="Email"
              required
              value={email}
              readOnly={emailLocked}
              disabled={emailLocked}
              onChange={(e) => setEmail(e.target.value)}
              className={emailLocked ? "opacity-80 cursor-not-allowed" : undefined}
            />
            {emailLocked && (
              <p className="text-xs text-muted-foreground px-1">
                This email was invited — it can&apos;t be changed.
              </p>
            )}
          </div>
          <Input
            type="password"
            placeholder="Password (min 6 chars)"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <SignupConsentFields
            acceptedTerms={acceptedTerms}
            setAcceptedTerms={setAcceptedTerms}
          />
          <Button className="w-full h-12" disabled={loading || !acceptedTerms}>
            {loading
              ? "Creating account…"
              : inviteToken
                ? COPY.startTrustedNetwork
                : COPY.startTrustedNetwork}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-muted-foreground">
          Already a member?{" "}
          <Link href="/login" className="text-primary font-medium">
            Log in
          </Link>
        </p>
      </motion.div>
    </>
  );
}
