import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import type { PrismaClient } from "@prisma/client";
import { resolveTargets, SIM_PASSWORD } from "@/lib/simulation/constants";
import type { SeedProgress } from "@/lib/simulation/seed";
import type { ValidationSummary } from "@/lib/simulation/validate";
import type { ScaleBenchmark } from "@/lib/simulation/benchmark";
import { prisma as defaultPrisma } from "@/lib/simulation/env";
import { SIM_EMAIL_DOMAIN } from "@/lib/simulation/constants";

function mdTable(headers: string[], rows: string[][]): string {
  const sep = headers.map(() => "---");
  return [`| ${headers.join(" | ")} |`, `| ${sep.join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

export async function collectSimulationStats(db: PrismaClient = defaultPrisma) {
  const simUsers = await db.user.findMany({
    where: { email: { endsWith: SIM_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const simUserIds = simUsers.map((u) => u.id);

  const [
    users,
    stories,
    publishedStories,
    draftStories,
    discoveries,
    messages,
    notifications,
    connections,
    sharedIntroducers,
    avgDegree,
  ] = await Promise.all([
    db.user.count({ where: { email: { endsWith: SIM_EMAIL_DOMAIN } } }),
    db.story.count({ where: { text: { contains: "[sim-seed]" } } }),
    db.story.count({ where: { text: { contains: "[sim-seed]" }, status: "published" } }),
    db.story.count({ where: { text: { contains: "[sim-seed]" }, status: "draft" } }),
    db.discoveriesPost.count({ where: { content: { contains: "[sim-seed]" } } }),
    db.message.count({ where: { message: { contains: "[sim-seed]" } } }),
    db.notification.count({ where: { message: { contains: "[sim-seed]" } } }),
    simUserIds.length
      ? db.userConnection.count({ where: { sourceUserId: { in: simUserIds } } })
      : Promise.resolve(0),
    db.sharedIntroducerRelationship.count(),
    db.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(cnt)::float AS avg FROM (
        SELECT COUNT(*) AS cnt FROM user_connections GROUP BY source_user_id
      ) s`,
  ]);

  const [feedCoverage, recommendationCoverage, introCoverage] = await Promise.all([
    db.user.count({
      where: {
        id: { in: simUserIds },
        stories: { some: { status: "published", tags: { some: {} } } },
      },
    }),
    db.user.count({
      where: {
        id: { in: simUserIds },
        connectionsFrom: { some: { sharedIntroducerCount: { gte: 2 } } },
      },
    }),
    db.user.count({
      where: {
        id: { in: simUserIds },
        OR: [
          { storyTags: { some: { story: { status: "published" } } } },
          { stories: { some: { status: "published", tags: { some: {} } } } },
        ],
      },
    }),
  ]);

  const density =
    simUserIds.length > 1
      ? connections / (simUserIds.length * (simUserIds.length - 1))
      : 0;

  return {
    users,
    stories,
    publishedStories,
    draftStories,
    discoveries,
    messages,
    notifications,
    connections,
    sharedIntroducers,
    avgTrustDegree: avgDegree[0]?.avg ?? 0,
    graphDensity: density,
    feedCoverage,
    recommendationCoverage,
    introCoverage,
    simUserCount: simUserIds.length,
  };
}

export function writeSimulationReport(input: {
  seed: SeedProgress;
  validation: ValidationSummary;
  stats: Awaited<ReturnType<typeof collectSimulationStats>>;
  slowQueries: Array<{ label: string; ms: number }>;
  targets?: ReturnType<typeof resolveTargets>;
}) {
  const targets = input.targets ?? resolveTargets();
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  const pass = input.validation.failed === 0 && input.validation.globalErrors.length === 0;

  const report = `# BuddyIntro Simulation Report

Generated: ${new Date().toISOString()}

## Summary

| Check | Result |
| ----- | ------ |
| Seed completed | ✓ |
| Validation | ${pass ? "**PASS**" : "**FAIL**"} |
| Users validated | ${input.validation.total} |
| Passed | ${input.validation.passed} |
| Failed | ${input.validation.failed} |

## Record counts

| Entity | Target | Actual |
| ------ | ------ | ------ |
| Users | ${targets.users.toLocaleString()} | ${input.stats.users.toLocaleString()} |
| Trust relationships (\`user_connections\`) | ${targets.trustRelationships.toLocaleString()} | ${input.stats.connections.toLocaleString()} |
| Tagged stories | ${targets.taggedStories.toLocaleString()} | ${input.stats.stories.toLocaleString()} |
| Published stories | — | ${input.stats.publishedStories.toLocaleString()} |
| Draft introduction requests | ${targets.introductionRequests.toLocaleString()} | ${input.stats.draftStories.toLocaleString()} |
| Discovery posts | ${targets.discoveryPosts.toLocaleString()} | ${input.stats.discoveries.toLocaleString()} |
| Messages | ${targets.messages.toLocaleString()} | ${input.stats.messages.toLocaleString()} |
| Notifications | ${targets.notifications.toLocaleString()} | ${input.stats.notifications.toLocaleString()} |
| Shared introducer rows | — | ${input.stats.sharedIntroducers.toLocaleString()} |

## Graph metrics

| Metric | Value |
| ------ | ----- |
| Graph density (connections / n×(n−1)) | ${input.stats.graphDensity.toFixed(6)} |
| Average trust degree (connections per source user) | ${Math.round(input.stats.avgTrustDegree)} |
| Feed coverage (users with outgoing intros) | ${input.stats.feedCoverage} / ${input.stats.simUserCount} (${pct(input.stats.feedCoverage, input.stats.simUserCount)}) |
| Recommendation coverage (≥2 shared introducers) | ${input.stats.recommendationCoverage} / ${input.stats.simUserCount} (${pct(input.stats.recommendationCoverage, input.stats.simUserCount)}) |
| Introduction coverage (sent or received) | ${input.stats.introCoverage} / ${input.stats.simUserCount} (${pct(input.stats.introCoverage, input.stats.simUserCount)}) |

## Slowest queries (smoke test)

${mdTable(["Query", "ms"], input.slowQueries.map((q) => [q.label, String(q.ms)]))}

## Validation failures

${input.validation.globalErrors.length ? input.validation.globalErrors.map((e) => `- **Global:** ${e}`).join("\n") : "No global errors."}

${input.validation.results
  .filter((r) => !r.ok)
  .slice(0, 25)
  .map((r) => `- \`${r.email}\`: ${r.errors.join("; ")}`)
  .join("\n") || "No per-user failures in sample."}

## Persona & graph design

> **Note:** user_connections rows are materialized BFS paths (up to degree 4), so actual counts exceed the sparse edge target (~15k at 1,000 users is a design guide; expect ~30k–80k depending on cluster density).

- **Regions:** Zimbabwe, South Africa, Botswana, Kenya, Nigeria, UK diaspora
- **Structure:** 20 industry/regional communities (~45 members) + 100 bridge users
- **Stories:** intra-community introductions + cross-community bridge intros (not fully connected)
- **Login:** \`sim-0@simulation.buddyintro.test\` … \`sim-999@simulation.buddyintro.test\` / password \`${SIM_PASSWORD}\`

## Commands

\`\`\`bash
npm run seed:simulation
npm run seed:simulation -- --reset
npm run seed:simulation -- --users=100   # scaled smoke test
\`\`\`
`;

  writeFileSync(resolve(process.cwd(), "docs/SIMULATION_REPORT.md"), report);
}

export function writeScalabilityReport(benchmarks: ScaleBenchmark[]) {
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });

  const sections = benchmarks
    .map((b) => {
      const rows = b.routes.map((r) => [
        r.route,
        String(r.p50Ms),
        String(r.p95Ms),
        String(r.maxMs),
      ]);
      return `### ${b.userCount.toLocaleString()} users (sampled ${b.sampledUsers})

${mdTable(["Route", "p50 (ms)", "p95 (ms)", "max (ms)"], rows)}

Total sampled wall time: **${b.totalMs}ms**`;
    })
    .join("\n\n");

  const report = `# BuddyIntro Scalability Report

Generated: ${new Date().toISOString()}

Server-side data-load proxies for SSR routes (Prisma timings on simulation dataset).

${sections}

## Notes

- Timings measure database work equivalent to Home, Discoveries, Introductions, Profile, and Message context loaders.
- Scales use the first N simulation users (\`sim-0\` … \`sim-{N-1}\`).
- Re-run after schema/index changes: \`npm run seed:simulation\`
`;

  writeFileSync(resolve(process.cwd(), "docs/SCALABILITY_REPORT.md"), report);
}

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function writePersonasArtifact(personas: unknown) {
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(resolve(process.cwd(), "docs/.simulation-personas.json"), JSON.stringify(personas, null, 2));
}
