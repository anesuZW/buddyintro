import type { ConnectionReason, IntroductionEvidence, IntroUser } from "@/lib/introduction-graph";

export function reasonTextForDepth(
  depth: number | null,
  introducerName: string | null,
  mutualCount: number
): { reason: string; label: string } {
  if (mutualCount > 1) {
    return {
      reason: "Mutual Introduction",
      label: `Connected through ${mutualCount} trusted connections`,
    };
  }
  if (depth === 1 && introducerName) {
    return { reason: "Introduced by", label: `Introduced by ${introducerName}` };
  }
  if (depth === 2 && introducerName) {
    return { reason: "Connected through", label: `Connected through ${introducerName}` };
  }
  if (depth && depth >= 3) {
    return {
      reason: `${depth} trusted connections away`,
      label: `${depth} trusted connections away`,
    };
  }
  return { reason: "Trusted network", label: "In your trusted introduction network" };
}

export function buildReasonFromEvidence(
  kind: ConnectionReason["kind"],
  reason: string,
  label: string,
  detail: string,
  evidence: IntroductionEvidence[],
  introducers: IntroUser[],
  mutualCount: number,
  connectionDepth: number | null = null
): ConnectionReason {
  const storyIds = evidence.map((e) => e.storyId);
  const primary = evidence[0] ?? null;
  return {
    reason,
    label,
    detail,
    kind,
    introducerUser: introducers[0] ?? primary?.introducer ?? null,
    introducerName: introducers[0]?.name ?? primary?.introducer.name ?? null,
    introductionStoryId: primary?.storyId ?? null,
    introductionStoryIds: storyIds,
    introductionDate: primary?.date ?? null,
    introducers,
    mutualCount,
    connectionDepth,
    evidence,
  };
}
