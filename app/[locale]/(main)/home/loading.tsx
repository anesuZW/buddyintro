import { HomeFeedSkeleton, HomeStatsSkeleton } from "@/components/home/HomePageSkeletons";

export default function HomeLoading() {
  return (
    <div>
      <HomeStatsSkeleton />
      <HomeFeedSkeleton />
    </div>
  );
}
