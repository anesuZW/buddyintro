import "server-only";

import { refreshConnectionsForUsers } from "@/services/introduction-graph-builder";
import { enqueueOrRun } from "@/services/jobs/job-service";
import { JOB_TYPES, QUEUES } from "@/services/jobs/types";

/** Queue or inline trust graph refresh after introductions change. */
export async function scheduleTrustGraphRefresh(userIds: string[]): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;

  await enqueueOrRun(
    {
      queue: QUEUES.TRUST,
      jobType: JOB_TYPES.TRUST_GRAPH_REBUILD,
      payload: { userIds: unique },
    },
    async () => {
      await refreshConnectionsForUsers(unique);
    }
  );
}
