"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { appUrl } from "@/lib/utils";
import { COPY } from "@/lib/copy";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(next);
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithMagicLink() {
    if (!email) return toast.error("Enter your email first");
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(next)}`) },
      });
      if (error) throw error;
      toast.success("Magic link sent — check your email!");
    } catch (err: any) {
      toast.error(err.message || "Could not send magic link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-8">
        <h1 className="text-2xl font-bold">{COPY.startTrustedNetwork}</h1>
        <p className="text-muted-foreground mt-1">{COPY.discoverThroughIntros}</p>

      <form onSubmit={loginWithPassword} className="mt-6 space-y-4">
        <Input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button className="w-full h-12" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        OR
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full h-12" onClick={loginWithMagicLink} disabled={loading}>
        Send magic link
      </Button>

      <p className="mt-6 text-sm text-center text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="text-primary font-medium">
          {COPY.startTrustedNetwork}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-muted-foreground">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
