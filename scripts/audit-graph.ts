/**
 * Introduction graph architecture audit — read-only.
 * Usage: npm run audit:graph
 */
import pg from "pg";
import fs from "fs";
import {
  loadEnv,
  printReport,
  walkTsFiles,
  rel,
  type AuditFinding,
} from "./audit-shared";

loadEnv();

type GraphService = {
  file: string;
  function: string;
  usesUserConnection: boolean;
  usesBfs: boolean;
  purpose: string;
};

const GRAPH_SERVICES: GraphService[] = [
  {
    file: "lib/discoveries-network.ts",
    function: "getDiscoveriesNetworkAuthorIds",
    usesUserConnection: true,
    usesBfs: true,
    purpose: "Discoveries author allow-list (fallback BFS via getNetworkUsers)",
  },
  {
    file: "services/discoveries.ts",
    function: "getDiscoveriesFeed",
    usesUserConnection: true,
    usesBfs: false,
    purpose: "Feed query filtered by networkIds from user_connections",
  },
  {
    file: "services/trust-profile.ts",
    function: "getTrustProfile",
    usesUserConnection: true,
    usesBfs: false,
    purpose: "Reads materialized sharedIntroducerCount/trustScore/degree",
  },
  {
    file: "lib/shared-introducers.ts",
    function: "getSharedIntroducersForPair",
    usesUserConnection: false,
    usesBfs: false,
    purpose: "Reads shared_introducer_relationships table directly",
  },
  {
    file: "lib/search-users-trust.ts",
    function: "searchUsersWithTrust",
    usesUserConnection: true,
    usesBfs: false,
    purpose: "Trust enrichment via getTrustProfilesBulk → user_connections",
  },
  {
    file: "services/chat-context.ts",
    function: "getChatContextPayload",
    usesUserConnection: true,
    usesBfs: true,
    purpose: "Graph context via getConversationGraphContext (live graph index + BFS path chain)",
  },
  {
    file: "lib/introduction-graph.ts",
    function: "getConnectionReasonsBulk",
    usesUserConnection: false,
    usesBfs: true,
    purpose: "N× getConnectionReason per author (loads full graph index each request)",
  },
  {
    file: "services/introduction-graph-builder.ts",
    function: "rebuildUserConnections",
    usesUserConnection: true,
    usesBfs: true,
    purpose: "Offline full-graph BFS materialization (maintenance only)",
  },
];

function classify(s: GraphService): "SAFE" | "WARNING" | "CRITICAL" {
  if (s.function === "rebuildUserConnections") return "SAFE";
  if (s.usesBfs && !s.usesUserConnection) return "WARNING";
  if (s.usesBfs && s.usesUserConnection) return "WARNING";
  if (s.file === "lib/introduction-graph.ts" && s.function === "getConnectionReasonsBulk") return "WARNING";
  return "SAFE";
}

async function main() {
  const findings: AuditFinding[] = [];

  for (const s of GRAPH_SERVICES) {
    const content = fs.readFileSync(s.file, "utf8");
    const hasBfs = /bfs|BFS|buildGraphIndex|getNetworkUsers|getIntroductionPathChain|getConnectionDepth/.test(content);
    const hasUc = /userConnection|user_connections|getNetworkUserIdsFromConnections|getConnectionDegreeFromStore/.test(content);
    findings.push({
      severity: classify(s),
      category: "Graph Architecture",
      title: `${s.file} → ${s.function}`,
      detail: `Purpose: ${s.purpose}. Uses user_connections: ${hasUc ? "yes" : "no"}. Live BFS/graph-index: ${hasBfs ? "yes" : "no"}.`,
      file: s.file,
      function: s.function,
      recommendation:
        classify(s) === "WARNING"
          ? "Prefer materialized user_connections + shared_introducer_relationships; cache graph index per request."
          : undefined,
    });
  }

  const bfsSites: Array<{ file: string; fn: string; line: number; snippet: string }> = [];
  for (const file of walkTsFiles(".")) {
    if (file.includes("node_modules") || file.includes(".next")) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/bfsConnections|buildGraphIndex|getNetworkUsers|getIntroductionPathChain|getConnectionDepth|frontier/.test(line)) {
        bfsSites.push({ file: rel(file), fn: "", line: i + 1, snippet: line.trim().slice(0, 80) });
      }
    });
  }

  const prodBfs = bfsSites.filter(
    (s) =>
      !s.file.includes("introduction-graph-builder.ts") &&
      !s.file.includes("audit-graph.ts") &&
      !s.file.includes("seed-demo")
  );

  for (const site of prodBfs.slice(0, 12)) {
    findings.push({
      severity: site.file.includes("introduction-graph.ts") ? "WARNING" : "INFO",
      category: "BFS Traversal",
      title: `${site.file}:${site.line}`,
      detail: site.snippet,
      recommendation:
        site.file.includes("introduction-graph.ts")
          ? "Acceptable with React cache() per request; risky at scale without materialized fallback for bulk paths."
          : undefined,
    });
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (url) {
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM user_connections) AS connections,
        (SELECT COUNT(*)::int FROM shared_introducer_relationships) AS shared,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM story_tags WHERE tagged_user_id IS NOT NULL) AS tags
    `);
    const c = counts.rows[0];
    const ratio = c.users > 0 ? c.connections / c.users : 0;
    findings.push({
      severity: ratio > 500 ? "WARNING" : "SAFE",
      category: "Materialization",
      title: "Graph materialization stats",
      detail: `users=${c.users}, user_connections=${c.connections} (${ratio.toFixed(1)}/user), shared_introducer=${c.shared}, story_tags=${c.tags}`,
      recommendation:
        ratio > 500
          ? "Full rebuildUserConnections is O(users × edges); schedule as background job only."
          : undefined,
    });

    const empty = c.connections === 0 && c.tags > 0;
    if (empty) {
      findings.push({
        severity: "CRITICAL",
        category: "Materialization",
        title: "user_connections empty but story_tags exist",
        recommendation: "Run npm run rebuild-connections",
      });
    } else if (c.connections > 0) {
      findings.push({
        severity: "SAFE",
        category: "Materialization",
        title: "user_connections populated",
      });
    }

    await client.end();
  }

  const critical = printReport("FriendIntro Graph Architecture Audit", findings);
  process.exit(critical > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
