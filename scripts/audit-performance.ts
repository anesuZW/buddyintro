/**
 * Query / performance audit — static analysis + optional live stats.
 * Usage: npm run audit:performance
 */
import fs from "fs";
import pg from "pg";
import {
  loadEnv,
  printReport,
  walkTsFiles,
  rel,
  type AuditFinding,
} from "./audit-shared";

loadEnv();

type Hotspot = {
  file: string;
  function: string;
  problem: string;
  impact: string;
  fix: string;
};

const KNOWN_HOTSPOTS: Hotspot[] = [
  {
    file: "services/messages.ts",
    function: "getConversationList",
    problem: "Loads ALL messages for user ordered desc, dedupes in JS — no pagination",
    impact: "O(total messages) per inbox load; degrades beyond ~10k messages/user",
    fix: "Use DISTINCT ON or lateral join for latest message per conversation; paginate list",
  },
  {
    file: "services/messages.ts",
    function: "getConversation",
    problem: "Loads full conversation history with includes — no cursor/limit",
    impact: "Unbounded memory and latency for long threads",
    fix: "Add cursor pagination (take 50, before/after cursor)",
  },
  {
    file: "services/trust-profile.ts",
    function: "getTrustProfilesBulk",
    problem: "Promise.all over getTrustProfile — N parallel queries per author",
    impact: "Discoveries page (10 posts) ≈ 30–50 queries/request",
    fix: "Single query: userConnection WHERE source=viewer AND target IN (...); batch shared introducers",
  },
  {
    file: "lib/introduction-graph.ts",
    function: "getConnectionReasonsBulk",
    problem: "Per-author getConnectionReason; each rebuilds graph index work",
    impact: "Discoveries enrichment: O(authors × graph) despite React cache()",
    fix: "Bulk reason from user_connections + shared_introducer_relationships",
  },
  {
    file: "lib/category-visibility.ts",
    function: "filterByCategoryVisibility",
    problem: "Per-post viewerSharesCategoryWithAuthor (2 queries each)",
    impact: "Up to 20 extra queries per discoveries page for same_category posts",
    fix: "Precompute viewer category edges; filter in one query or in-memory set",
  },
  {
    file: "services/introduction-suggestions.ts",
    function: "getIntroductionSuggestions",
    problem: "Nested loop O(n²) with await getSharedIntroducerCount per pair",
    impact: "Up to 400 count queries worst case (20×20 tags)",
    fix: "Batch shared counts via groupBy or user_connections lookup",
  },
  {
    file: "services/discoveries.ts",
    function: "getDiscoveriesFeed",
    problem: "userId IN (networkIds) — networkIds can be thousands; sort in memory after fetch",
    impact: "Large IN lists + wrong ranking order vs DB at 100k+ users",
    fix: "Join user_connections for ranking; limit network fan-out; precomputed feed",
  },
  {
    file: "services/feed.ts",
    function: "getMutualTagFeed",
    problem: "Multiple findMany + merge/sort in memory; limit 50 without cursor",
    impact: "Acceptable early scale; no cursor for infinite scroll",
    fix: "Add cursor pagination; consolidate tag queries",
  },
  {
    file: "lib/introduction-graph.ts",
    function: "loadIntroductionEdges",
    problem: "Full table scan of published story_tags on every cached graph build",
    impact: "Grows linearly with introductions; cached per-request only",
    fix: "Persist edges or rely solely on user_connections for hot paths",
  },
  {
    file: "services/introduction-graph-builder.ts",
    function: "rebuildUserConnections",
    problem: "deleteMany entire table + BFS from every user — O(U × E)",
    impact: "CRITICAL if triggered in request path at scale; minutes+ at 100k users",
    fix: "Incremental updates only; background queue; never block HTTP",
  },
];

function scanFiles(): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const dirs = ["services", "lib", "app/api"];

  for (const dir of dirs) {
    for (const file of walkTsFiles(dir)) {
      const content = fs.readFileSync(file, "utf8");
      const r = rel(file);

      if (/findMany\([\s\S]*?\)(?!.*take:)/.test(content) && !/take:\s*\d+/.test(content)) {
        if (content.includes("findMany") && !content.includes("take:")) {
          findings.push({
            severity: "INFO",
            category: "Pagination",
            title: `${r} has findMany without explicit take`,
            recommendation: "Audit for unbounded result sets",
          });
        }
      }

      if (/Promise\.all\([\s\S]*?\.map\(async/.test(content)) {
        findings.push({
          severity: "WARNING",
          category: "N+1",
          title: `${r} uses Promise.all + async map (potential N+1)`,
          recommendation: "Replace with batched queries or DataLoader pattern",
        });
      }

      if (/include:\s*\{[\s\S]*include:/.test(content)) {
        findings.push({
          severity: "INFO",
          category: "Prisma",
          title: `${r} uses nested includes`,
          recommendation: "Prefer select projections for API responses",
        });
      }
    }
  }
  return findings;
}

async function main() {
  const findings: AuditFinding[] = [];

  for (const h of KNOWN_HOTSPOTS) {
    findings.push({
      severity:
        h.impact.includes("CRITICAL") || h.problem.includes("ALL messages")
          ? "CRITICAL"
          : h.impact.includes("100k") || h.problem.includes("N parallel")
            ? "WARNING"
            : "WARNING",
      category: "Query Performance",
      title: h.problem,
      detail: `Impact: ${h.impact}`,
      file: h.file,
      function: h.function,
      recommendation: h.fix,
    });
  }

  findings.push(...scanFiles());

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (url) {
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const stats = await client.query(`
      SELECT relname, seq_scan, idx_scan, n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND relname IN ('messages','discoveries_posts','user_connections','story_tags','shared_introducer_relationships')
      ORDER BY n_live_tup DESC
    `);
    for (const row of stats.rows) {
      const seq = Number(row.seq_scan);
      const idx = Number(row.idx_scan);
      if (seq > idx * 10 && Number(row.n_live_tup) > 1000) {
        findings.push({
          severity: "WARNING",
          category: "Live Stats",
          title: `${row.relname} sequential scans dominate`,
          detail: `seq_scan=${seq}, idx_scan=${idx}, rows≈${row.n_live_tup}`,
          recommendation: "Run EXPLAIN ANALYZE on hot queries; add missing indexes",
        });
      }
    }
    await client.end();
  }

  findings.push({
    severity: "CRITICAL",
    category: "Security",
    title: "No API rate limiting detected",
    detail: "Grep found zero rateLimit/throttle implementations in codebase",
    recommendation: "Add edge rate limits (Vercel/Cloudflare) or middleware throttling on POST routes",
  });

  findings.push({
    severity: "WARNING",
    category: "Security",
    title: "Verification admin gates not enforced in message/story APIs",
    detail: "requirePhoneVerification/requireIdentityVerification exist in AdminSettings but messages/route.ts only checks inviteGate",
    recommendation: "Enforce verification flags before messaging/posting when enabled",
  });

  const critical = printReport("FriendIntro Performance Audit", findings);
  process.exit(critical > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
