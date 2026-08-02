"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSessionOk(Boolean(data.session));
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password.length < 6) {
      const message = t("passwordTooShort");
      setFormError(message);
      toast.error(message);
      return;
    }
    if (password !== confirm) {
      const message = t("passwordsDoNotMatch");
      setFormError(message);
      toast.error(message);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("passwordUpdated"));
      router.replace("/home");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("passwordUpdateFailed");
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="card p-8 text-center text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  if (!sessionOk) {
    return (
      <div className="card p-8">
        <h1 className="text-2xl font-bold">{t("resetPasswordTitle")}</h1>
        <div
          role="alert"
          className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t("resetLinkInvalid")}
        </div>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          <Link href="/forgot-password" className="text-primary font-medium">
            {t("sendResetLink")}
          </Link>
          {" · "}
          <Link href="/login" className="text-primary font-medium">
            {t("backToSignIn")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold">{t("resetPasswordTitle")}</h1>
      <p className="text-muted-foreground mt-1">{t("resetPasswordHint")}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {formError}
          </div>
        ) : null}
        <Input
          type="password"
          placeholder={t("newPassword")}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          type="password"
          placeholder={t("confirmPassword")}
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <Button className="w-full h-12" disabled={loading}>
          {loading ? tCommon("loading") : t("updatePassword")}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-center text-muted-foreground">
          {tCommon("loading")}
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
