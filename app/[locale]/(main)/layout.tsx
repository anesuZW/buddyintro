import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { BottomNav } from "@/components/layout/BottomNav";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import {
  BottomNavWithBadge,
  TopBarShell,
  TopBarWithBadges,
} from "@/components/layout/LayoutBadges";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh flex flex-col">
      <Suspense fallback={<TopBarShell user={user} />}>
        <TopBarWithBadges user={user} />
      </Suspense>
      <div className="flex-1 pb-nav pt-16 max-w-2xl w-full mx-auto">{children}</div>
      <InstallPrompt />
      <Suspense fallback={<BottomNav introBadge={0} />}>
        <BottomNavWithBadge user={user} />
      </Suspense>
    </div>
  );
}
