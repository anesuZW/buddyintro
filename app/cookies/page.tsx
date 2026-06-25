import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { BRAND } from "@/lib/branding";
import { LEGAL_ENTITY, LEGAL_VERSIONS } from "@/lib/legal-versions";

export default function CookiesPage() {
  return (
    <main className="min-h-dvh px-6 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary font-medium">
        ← {BRAND.name}
      </Link>
      <h1 className="text-3xl font-bold mt-6">Cookie Policy</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Version {LEGAL_VERSIONS.cookies} · {LEGAL_ENTITY.name}
      </p>
      <article className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">Essential cookies</h2>
          <p>Required for authentication, session management, and security. Cannot be disabled while using the app.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Authentication cookies</h2>
          <p>Supabase session cookies keep you signed in securely.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Functional cookies</h2>
          <p>Store invite onboarding state and theme preferences locally.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Analytics cookies</h2>
          <p>Non-essential cookies that help us understand usage. Enabled only with your consent.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Managing preferences</h2>
          <p>
            Use the cookie banner to Accept All, Reject Non-Essential, or Customize. You can
            change preferences anytime in your profile settings.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p>{LEGAL_ENTITY.supportEmail} · {LEGAL_ENTITY.address}</p>
        </section>
      </article>
      <LegalFooter className="mt-12 pb-8" />
    </main>
  );
}
