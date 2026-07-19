import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { BRAND } from "@/lib/branding";
import { LEGAL_ENTITY, LEGAL_VERSIONS } from "@/lib/legal-versions";

export default function TermsPage() {
  return (
    <main className="min-h-dvh px-6 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary font-medium">
        ← {BRAND.name}
      </Link>
      <h1 className="text-3xl font-bold mt-6">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Version {LEGAL_VERSIONS.terms} · {LEGAL_ENTITY.name}
      </p>
      <article className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">1. Acceptance</h2>
          <p>
            By accessing {BRAND.name}, you agree to these Terms and our Privacy Policy.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">2. Eligibility</h2>
          <p>You must be at least 13 years old to use {BRAND.name}.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">3. Accounts</h2>
          <p>
            You are responsible for safeguarding your credentials and all activity under your account.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">4. User content</h2>
          <p>You retain ownership of content you post. You are solely responsible for your content.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">5. License to {BRAND.name}</h2>
          <p>
            You grant {LEGAL_ENTITY.name} a worldwide, non-exclusive, royalty-free license to host,
            store, reproduce, and display your content solely to operate the service.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">6. Prohibited conduct</h2>
          <p>You may not harass, impersonate, spam, commit fraud, infringe intellectual property, or upload illegal content.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">7. Invitations</h2>
          <p>You must only invite people you know and have permission to contact.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">8. Messaging</h2>
          <p>Messages are private between participants. Do not use messaging for unlawful purposes.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">9. Moderation</h2>
          <p>We may remove content or suspend accounts that violate these Terms.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">10–15. Liability, IP, termination</h2>
          <p>
            {BRAND.name} is provided &quot;as is.&quot; To the maximum extent permitted by law, we disclaim
            warranties and limit liability. You agree to indemnify us for claims arising from your
            use. We may terminate accounts for violations. Governing law applies as specified by{" "}
            {LEGAL_ENTITY.name} at {LEGAL_ENTITY.address}. Contact: {LEGAL_ENTITY.supportEmail}.
          </p>
        </section>
      </article>
      <LegalFooter className="mt-12 pb-8" />
    </main>
  );
}
