import "server-only";

import { prisma } from "@/lib/prisma";

export type DbRecommendation = {
  kind: "missing_index" | "slow_query" | "unused_index" | "n_plus_one";
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  suggestion?: string;
};

/** Static + pg_catalog heuristics for DBA recommendations. */
export async function analyzeDatabasePerformance(): Promise<DbRecommendation[]> {
  const recommendations: DbRecommendation[] = [];

  const fkCandidates = [
    { table: "stories", column: "user_id", index: "stories_user_id_idx" },
    { table: "messages", column: "sender_id", index: "messages_sender_id_idx" },
    { table: "notifications", column: "user_id", index: "notifications_user_id_idx" },
    { table: "media_objects", column: "owner_id", index: "media_objects_owner_id_created_at_idx" },
  ];

  for (const candidate of fkCandidates) {
    try {
      const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2
        ) AS exists`,
        candidate.table,
        candidate.index
      );
      if (!rows[0]?.exists) {
        recommendations.push({
          kind: "missing_index",
          severity: "warn",
          title: `Missing index on ${candidate.table}.${candidate.column}`,
          detail: `Expected index ${candidate.index} was not found in pg_indexes.`,
          suggestion: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${candidate.index}" ON "${candidate.table}" ("${candidate.column}");`,
        });
      }
    } catch {
      /* pg_indexes unavailable */
    }
  }

  try {
    const slow = await prisma.$queryRaw<
      { query: string; calls: bigint; mean_time: number }[]
    >`
      SELECT LEFT(query, 120) AS query, calls, mean_exec_time AS mean_time
      FROM pg_stat_statements
      WHERE mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 5
    `;
    for (const row of slow) {
      recommendations.push({
        kind: "slow_query",
        severity: "warn",
        title: "Slow query detected",
        detail: `${row.query} (avg ${Math.round(row.mean_time)}ms, ${row.calls} calls)`,
        suggestion: "Review query plan and add targeted indexes.",
      });
    }
  } catch {
    recommendations.push({
      kind: "slow_query",
      severity: "info",
      title: "pg_stat_statements unavailable",
      detail: "Enable the pg_stat_statements extension for slow query detection.",
    });
  }

  recommendations.push({
    kind: "n_plus_one",
    severity: "info",
    title: "Audit Prisma include/select usage",
    detail: "Review feed, stories, and discoveries routes for unbatched relation loads.",
    suggestion: "Use prisma.$transaction batching or dataloaders for hot paths.",
  });

  return recommendations;
}
