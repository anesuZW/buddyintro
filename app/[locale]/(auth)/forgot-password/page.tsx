"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Link } from "@/lib/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { appUrl } from "@/lib/utils";

function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: appUrl("/auth/callback?next=/reset-password"),
      });
      if (error) throw error;
      setSent(true);
      toast.success(t("resetEmailSent"));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("resetEmailFailed");
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold">{t("forgotPasswordTitle")}</h1>
      <p className="text-muted-foreground mt-1">{t("forgotPasswordHint")}</p>

      {sent ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm"
        >
          {t("resetEmailSent")}
        </div>
      ) : (
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
            type="email"
            placeholder={t("email")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button className="w-full h-12" disabled={loading}>
            {loading ? tCommon("loading") : t("sendResetLink")}
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-center text-muted-foreground">
        <Link href="/login" className="text-primary font-medium">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-center text-muted-foreground">
          {tCommon("loading")}
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
