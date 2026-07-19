import Link from "next/link";
import { BRAND_INITIALS } from "@/lib/branding";
import { COPY } from "@/lib/copy";
import { LegalFooter } from "@/components/legal/LegalFooter";

export default async function LandingPage() {
  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <span className="font-bold text-lg">{COPY.appName}</span>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            {COPY.startTrustedNetwork}
          </Link>
        </div>
      </header>

      <section className="px-6 py-8 fi-gradient-bg border-b border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">{COPY.buildTrustedNetwork}</h2>
          <p className="mt-4 text-muted-foreground">{COPY.buildTrustedNetworkBody}</p>
          <p className="mt-3 text-sm text-primary font-medium">{COPY.notSocialMedia}</p>
        </div>
      </section>

      <section className="flex-1 flex items-center justify-center text-center px-6 py-12">
        <div className="max-w-2xl">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-story-ring p-[3px] mb-8 shadow-lg shadow-primary/20">
            <div className="bg-background rounded-3xl h-full w-full flex items-center justify-center text-2xl font-bold fi-gradient-text">
              {BRAND_INITIALS}
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Trusted introductions —{" "}
            <span className="fi-gradient-text">not another social feed.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">{COPY.appDescription}</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/signup" className="btn-primary px-6 py-3">
              {COPY.startTrustedNetwork}
            </Link>
            <Link href="/login" className="btn-ghost px-6 py-3">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-6">
        <LegalFooter />
      </footer>
    </main>
  );
}
