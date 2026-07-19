"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { appUrl } from "@/lib/utils";

function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
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
      toast.error(err.message || t("loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function loginWithMagicLink() {
    if (!email) return toast.error(t("enterEmailFirst"));
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(next)}`) },
      });
      if (error) throw error;
      toast.success(t("magicLinkSent"));
    } catch (err: any) {
      toast.error(err.message || t("magicLinkFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold">{t("startTrustedNetwork")}</h1>
      <p className="text-muted-foreground mt-1">{t("discoverThroughIntros")}</p>

      <form onSubmit={loginWithPassword} className="mt-6 space-y-4">
        <Input
          type="email"
          placeholder={t("email")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("password")}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button className="w-full h-12" disabled={loading}>
          {loading ? t("signingIn") : t("signIn")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        {tCommon("or")}
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full h-12" onClick={loginWithMagicLink} disabled={loading}>
        {t("magicLink")}
      </Button>

      <p className="mt-6 text-sm text-center text-muted-foreground">
        {t("newHere")}{" "}
        <Link href="/signup" className="text-primary font-medium">
          {t("startTrustedNetwork")}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<div className="card p-8 text-center text-muted-foreground">{tCommon("loading")}</div>}>
      <LoginForm />
    </Suspense>
  );
}
