import type { AdminSettings } from "@prisma/client";

/** Effective max discovery depth — smaller of maxDiscoveryDepth and allowed degree flags. */
export function getEffectiveDiscoveryDepth(settings: AdminSettings): number {
  if (!settings.enableIntroductionGraph) return 0;
  if (!settings.allowFirstDegreeDiscovery) return 0;

  let max = settings.maxDiscoveryDepth ?? settings.discoveriesNetworkDepth ?? 2;

  if (!settings.allowFourthDegreeDiscovery) max = Math.min(max, 3);
  if (!settings.allowThirdDegreeDiscovery) max = Math.min(max, 2);
  if (!settings.allowSecondDegreeDiscovery) max = Math.min(max, 1);

  return Math.max(0, Math.min(4, max));
}

export function depthLabel(depth: number): string {
  if (depth <= 1) return "Introduced by";
  if (depth === 2) return "Connected through";
  return `${depth} trusted connections away`;
}
