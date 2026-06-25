import { trustRankTierLabel } from "@/lib/trust-rank";
import type { TrustRankTier } from "@prisma/client";
import { Award } from "lucide-react";

const tierStyles: Record<TrustRankTier, string> = {
  bronze: "bg-amber-900/10 text-amber-800",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-indigo-100 text-indigo-800",
  diamond: "bg-cyan-100 text-cyan-900",
};

export function TrustRankBadge({
  tier,
  compact = false,
}: {
  tier?: TrustRankTier | string | null;
  compact?: boolean;
}) {
  if (!tier || tier === "bronze") return null;

  const style = tierStyles[tier as TrustRankTier] ?? tierStyles.silver;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${style} ${
        compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
    >
      <Award size={compact ? 10 : 12} />
      {trustRankTierLabel(tier as TrustRankTier)}
    </span>
  );
}
