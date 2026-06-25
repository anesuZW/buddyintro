import Link from "next/link";
import type { TrustProfilePayload } from "@/types";
import { trustRankTierLabel } from "@/lib/trust-rank";
import type { TrustRankTier } from "@prisma/client";

export function DiscoveryTrustExplanation({
  authorUserId,
  trustProfile,
  connectionDepth,
  categoryName,
}: {
  authorUserId: string;
  trustProfile?: TrustProfilePayload | null;
  connectionDepth?: number | null;
  categoryName?: string | null;
}) {
  if (!trustProfile && !connectionDepth && !categoryName) return null;

  const shared = trustProfile?.sharedIntroducerCount ?? 0;
  const tier = trustProfile?.trustRankTier as TrustRankTier | undefined;

  const lines: Array<{ text: string; href?: string }> = [];

  if (shared > 0) {
    lines.push({
      text:
        shared === 1
          ? "1 shared introducer"
          : `${shared} shared introducers`,
      href: `/profile/${authorUserId}`,
    });
  }

  if (connectionDepth && connectionDepth > 0) {
    lines.push({
      text:
        connectionDepth === 1
          ? "Direct trusted connection"
          : `${connectionDepth} trusted connection${connectionDepth === 1 ? "" : "s"} away`,
    });
  }

  if (categoryName) {
    lines.push({ text: `${categoryName} network` });
  }

  if (tier) {
    lines.push({ text: `${trustRankTierLabel(tier as TrustRankTier)} trust rank` });
  }

  if (!lines.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {lines.map((line) =>
        line.href ? (
          <Link
            key={line.text}
            href={line.href}
            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:underline"
          >
            {line.text}
          </Link>
        ) : (
          <span
            key={line.text}
            className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
          >
            {line.text}
          </span>
        )
      )}
    </div>
  );
}
