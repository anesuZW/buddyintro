import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { BottomNav } from "@/components/layout/BottomNav";
import { LazyInstallPrompt } from "@/components/pwa/LazyInstallPrompt";
import { ServiceUnavailable } from "@/components/layout/ServiceUnavailable";
import {
  BottomNavWithBadge,
  TopBarShell,
  TopBarWithBadges,
} from "@/components/layout/LayoutBadges";

function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    console.error("[main/layout] requireUser failed", err);
    return <ServiceUnavailable />;
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <Suspense fallback={<TopBarShell user={user} />}>
        <TopBarWithBadges user={user} />
      </Suspense>
      <div className="flex-1 pb-nav pt-16 max-w-2xl w-full mx-auto">{children}</div>
      <LazyInstallPrompt />
      <Suspense fallback={<BottomNav introBadge={0} />}>
        <BottomNavWithBadge user={user} />
      </Suspense>
    </div>
  );
}
