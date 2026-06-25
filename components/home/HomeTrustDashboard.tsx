import { TrustNetworkDashboard } from "@/components/home/TrustNetworkDashboard";
import { loadHomeDashboardStats } from "@/services/home-dashboard";

export async function HomeTrustDashboard({ userId }: { userId: string }) {
  const stats = await loadHomeDashboardStats(userId);
  return (
    <div data-home-stats="hydrated">
      <TrustNetworkDashboard stats={stats} />
    </div>
  );
}
