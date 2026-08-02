import "server-only";

import { cache } from "react";
import { getNetworkUsers, getDiscoveriesConnectionReason, getConnectionReason, getIntroductionEvidence } from "@/lib/introduction-graph";
import { getEffectiveDiscoveryDepth } from "@/lib/network-depth";
import { getAdminSettings } from "@/services/admin";
import {
  getNetworkUserIdsFromConnections,
  isUserConnectionsMaterialized,
} from "@/services/introduction-graph-builder";

/**
 * User IDs whose Discoveries posts `viewerId` may see,
 * based on introduction network depth admin settings.
 * Uses precomputed user_connections when available; falls back to live BFS.
 */
/** Request-scoped dedupe — feed + access checks share the same network list. */
export const getDiscoveriesNetworkAuthorIds = cache(async (viewerId: string): Promise<string[]> => {
  const settings = await getAdminSettings();
  if (!settings.discoveriesEnabled || !settings.enableIntroductionGraph) {
    return [viewerId];
  }
  const depth = getEffectiveDiscoveryDepth(settings);

  if (await isUserConnectionsMaterialized()) {
    const connected = await getNetworkUserIdsFromConnections(viewerId, depth);
    return [viewerId, ...connected];
  }

  return getNetworkUsers(viewerId, depth);
});

export { getDiscoveriesConnectionReason, getConnectionReason, getIntroductionEvidence };
