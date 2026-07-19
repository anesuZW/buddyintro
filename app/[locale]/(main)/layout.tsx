import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { BottomNav } from "@/components/layout/BottomNav";
import { InstallBanner } from "@/components/pwa/PwaShell";
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
      <div className="flex-1 pb-24 pt-16 max-w-2xl w-full mx-auto">{children}</div>
      <InstallBanner />
      <Suspense fallback={<BottomNav introBadge={0} />}>
        <BottomNavWithBadge user={user} />
      </Suspense>
    </div>
  );
}
