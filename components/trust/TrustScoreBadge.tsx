import type { TrustProfilePayload } from "@/types";

export function TrustScoreBadge({
  trustProfile,
  showScore = true,
}: {
  trustProfile: Pick<
    TrustProfilePayload,
    "trustLevelLabel" | "trustScore" | "sharedIntroducerCount"
  >;
  showScore?: boolean;
}) {
  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-primary">
        {trustProfile.sharedIntroducerCount > 0
          ? `${trustProfile.sharedIntroducerCount} Shared Introducer${trustProfile.sharedIntroducerCount === 1 ? "" : "s"}`
          : "No Shared Introducers"}
      </span>
      <span className="text-[11px] text-muted-foreground">{trustProfile.trustLevelLabel}</span>
      {showScore && (
        <span className="text-[10px] text-muted-foreground">
          Trust Score {trustProfile.trustScore}
        </span>
      )}
    </div>
  );
}
