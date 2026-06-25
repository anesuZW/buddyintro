import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { BRAND } from "@/lib/branding";
import { LEGAL_ENTITY, LEGAL_VERSIONS } from "@/lib/legal-versions";

function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh px-6 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary font-medium">
        ← {BRAND.name}
      </Link>
      <h1 className="text-3xl font-bold mt-6">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Last updated: {LEGAL_VERSIONS.privacy} · {LEGAL_ENTITY.name}
      </p>
      <article className="prose prose-sm dark:prose-invert mt-8 space-y-6 text-foreground max-w-none">
        {children}
      </article>
      <LegalFooter className="mt-12 pb-8" />
    </main>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <section>
        <h2 className="text-xl font-semibold">1. Information we collect</h2>
        <p>
          {LEGAL_ENTITY.name} (&quot;{BRAND.name}&quot;, &quot;we&quot;, &quot;us&quot;) collects information you
          provide directly, including profile information (name, email, profile picture),
          media uploads (photos, videos, voice notes), messages, contacts you voluntarily
          provide for invitations (email addresses and phone numbers), invitation metadata,
          and usage analytics where you consent.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">2. How we use information</h2>
        <p>
          We use your information to operate {BRAND.name}, deliver introduction stories,
          send invitations, enable messaging, personalize your feed, maintain security,
          comply with law, and improve the service.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">3. Story visibility</h2>
        <p>
          Stories are visible according to co-tagging rules: you see stories you authored,
          stories where you are tagged, and published stories from authors in your mutual-tag
          network. Draft stories with pending invitations remain private until invitees register.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">4. User-generated content</h2>
        <p>
          You retain ownership of content you upload. You grant {BRAND.name} a limited license
          to host, display, and transmit your content solely to operate the service.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">5. Invitations and referrals</h2>
        <p>
          When you invite others by email or phone, we process the contact details you provide
          to deliver invitations. Invitees may preview stories before registering.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">6. Cookies</h2>
        <p>
          We use essential authentication cookies and, with consent, analytics cookies. See our{" "}
          <Link href="/cookies">Cookie Policy</Link>.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">7. Legal basis (UK & EU)</h2>
        <p>
          For users in the United Kingdom and European Economic Area, we process personal data
          based on contract performance, legitimate interests (security, product improvement),
          consent (cookies, marketing), and legal obligations.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">8. Your rights</h2>
        <p>
          Depending on your location (including Zimbabwe, South Africa, UK, and EU), you may
          have rights to access, rectify, erase, restrict, port, or object to processing of
          your data. Contact {LEGAL_ENTITY.supportEmail} to exercise these rights.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">9. Data retention</h2>
        <p>
          We retain data while your account is active and as needed for legal, security, and
          operational purposes. Expiring stories and posts are removed according to platform settings.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">10. Security</h2>
        <p>
          We implement technical and organizational measures including encryption in transit,
          access controls, and secure cloud infrastructure (Supabase).
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">11. Children&apos;s privacy</h2>
        <p>
          {BRAND.name} is not intended for children under 13. We do not knowingly collect data
          from children under 13. If you believe a child has provided data, contact us.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">12. International transfers</h2>
        <p>
          Your data may be processed in countries outside your own. We use appropriate safeguards
          including standard contractual clauses where required.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">13. Contact</h2>
        <p>
          {LEGAL_ENTITY.name}<br />
          {LEGAL_ENTITY.address}<br />
          Email: {LEGAL_ENTITY.supportEmail}
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">14. Changes</h2>
        <p>
          We may update this policy. Material changes will be communicated in-app or by email.
          Continued use after changes constitutes acceptance of the updated policy.
        </p>
      </section>
    </LegalLayout>
  );
}
