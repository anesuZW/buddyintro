import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { COPY } from "@/lib/copy";
import { runWithPerf } from "@/lib/perf/context";
import { HomeTrustDashboard } from "@/components/home/HomeTrustDashboard";
import { HomeSecondaryPanels } from "@/components/home/HomeSecondaryPanels";
import { HomeFeedPanels } from "@/components/home/HomeFeedPanels";
import {
  HomeFeedSkeleton,
  HomeSecondarySkeleton,
  HomeStatsSkeleton,
} from "@/components/home/HomePageSkeletons";

export default async function HomePage() {
  return runWithPerf({ kind: "page", label: "/home" }, async () => {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    return (
      <div data-home-page="streamed">
        <Suspense fallback={<HomeStatsSkeleton />}>
          <HomeTrustDashboard userId={user.id} />
        </Suspense>

        <Suspense fallback={<HomeSecondarySkeleton />}>
          <HomeSecondaryPanels userId={user.id} />
        </Suspense>

        <div className="px-4 pb-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{COPY.yourIntroductions}</h2>
        </div>

        <Suspense fallback={<HomeFeedSkeleton />}>
          <HomeFeedPanels userId={user.id} />
        </Suspense>
      </div>
    );
  });
}
