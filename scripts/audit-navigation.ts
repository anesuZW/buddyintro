/**
 * Runtime navigation audit — validates Link/router targets against App Router pages.
 * Includes Trust Network card registry from lib/introduction-routes.ts.
 * Usage: npm run audit:navigation
 */
import fs from "fs";
import path from "path";
import {
  TRUST_NETWORK_CARDS,
  navigationPath,
  type TrustNetworkCardDef,
} from "../lib/introduction-routes";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "hooks"].map((d) => path.join(ROOT, d));

type RouteInfo = { pattern: string; file: string };

function walk(dir: string, cb: (file: string) => void) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, cb);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      cb(full);
    }
  }
}

function collectAppRoutes(): RouteInfo[] {
  const appDir = path.join(ROOT, "app");
  const routes: RouteInfo[] = [];

  function scan(dir: string, segments: string[]) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "api") continue;
        if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
          scan(full, segments);
        } else if (entry.name.startsWith("[")) {
          scan(full, [...segments, "[param]"]);
        } else {
          scan(full, [...segments, entry.name]);
        }
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        const pattern = segments.length ? `/${segments.join("/")}` : "/";
        routes.push({ pattern, file: path.relative(ROOT, full) });
      }
    }
  }

  scan(appDir, []);
  return routes;
}

function normalizeHrefForCheck(href: string): string {
  let base = navigationPath(href);
  if (base.endsWith("/") && base.length > 1) {
    const parts = base.replace(/\/+$/, "").split("/").filter(Boolean);
    base = "/" + [...parts, "[param]"].join("/");
  }
  return base;
}

function pageExistsForHref(href: string, routes: RouteInfo[]): { ok: boolean; file?: string } {
  const base = normalizeHrefForCheck(href);
  if (base === "/") {
    const hit = routes.find((r) => r.pattern === "/");
    return { ok: Boolean(hit), file: hit?.file };
  }

  const exact = routes.find((r) => r.pattern === base);
  if (exact) return { ok: true, file: exact.file };

  const parts = base.split("/").filter(Boolean);
  const pattern =
    "/" +
    parts
      .map((p) => (/^[0-9a-f-]{36}$/i.test(p) ? "[param]" : p))
      .join("/");

  const dynamic = routes.find((r) => r.pattern === pattern);
  if (dynamic) return { ok: true, file: dynamic.file };

  return { ok: false };
}

function extractHrefs(content: string): string[] {
  const found: string[] = [];
  const patterns = [
    /href=["'](\/[^"'#?]+)["']/g,
    /href=\{["'](\/[^"'#?]+)["']\}/g,
    /href=\{`(\/[^`$]+)`\}/g,
    /href=\{`(\/[^`$]+)\$\{/g,
    /router\.push\(["'](\/[^"'#?]+)["']\)/g,
    /router\.push\(`(\/[^`$]+)`\)/g,
    /router\.push\(`(\/[^`$]+)\$\{/g,
    /redirect\(["'](\/[^"'#?]+)["']\)/g,
    /redirect\(`(\/[^`$]+)`\)/g,
    /redirect\(`(\/[^`$]+)\$\{/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      found.push(m[1].split("?")[0].split("#")[0] || "/");
    }
  }
  return found;
}

function auditTrustNetworkCards(routes: RouteInfo[], sampleUserId: string) {
  const rows: Array<{
    card: TrustNetworkCardDef;
    component: string;
    href: string;
    routePushed: string;
    targetPage: string;
    pageFile: string | undefined;
    ok: boolean;
  }> = [];

  for (const card of TRUST_NETWORK_CARDS) {
    const href = card.resolveHref(sampleUserId);
    const routePushed = navigationPath(href);
    const check = pageExistsForHref(href, routes);
    rows.push({
      card,
      component: "components/introductions/IntroductionNetworkPanel.tsx",
      href,
      routePushed,
      targetPage: card.targetPage,
      pageFile: check.file,
      ok: check.ok,
    });
  }
  return rows;
}

function main() {
  const routes = collectAppRoutes();
  const sampleUserId = "00000000-0000-4000-8000-000000000001";
  const trustRows = auditTrustNetworkCards(routes, sampleUserId);

  const brokenTrust = trustRows.filter((r) => !r.ok);

  const hrefIssues: Array<{ href: string; file: string }> = [];
  for (const dir of SCAN_DIRS) {
    walk(dir, (file) => {
      if (file.includes("audit-navigation.ts")) return;
      const content = fs.readFileSync(file, "utf8");
      for (const href of extractHrefs(content)) {
        const check = pageExistsForHref(href, routes);
        if (!check.ok && !href.startsWith("/api/")) {
          hrefIssues.push({ href, file: path.relative(ROOT, file) });
        }
      }
    });
  }

  const uniqueHrefIssues = [...new Map(hrefIssues.map((h) => [`${h.href}|${h.file}`, h])).values()];

  console.log("\n=== FriendIntro Navigation Audit ===\n");
  console.log("Trust Network cards (/introductions):\n");
  for (const row of trustRows) {
    const icon = row.ok ? "✓" : "✗";
    console.log(`${icon} ${row.card.title}`);
    console.log(`    component: ${row.component}`);
    console.log(`    href: ${row.href}`);
    console.log(`    route: ${row.routePushed}`);
    console.log(`    page: ${row.pageFile ?? "MISSING"}`);
    console.log("");
  }

  if (uniqueHrefIssues.length) {
    console.log("Other broken navigation targets:");
    for (const issue of uniqueHrefIssues.slice(0, 15)) {
      console.log(`  ✗ ${issue.href} in ${issue.file}`);
    }
    if (uniqueHrefIssues.length > 15) {
      console.log(`  … and ${uniqueHrefIssues.length - 15} more`);
    }
    console.log("");
  } else if (!brokenTrust.length) {
    console.log("✓ All scanned Link/router targets resolve to pages\n");
  }

  const reportLines = [
    "# Introductions Navigation Fix Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Root cause",
    "",
    "Three Trust Network cards linked to `/introductions/network?users={singleUserId}`.",
    "The network page requires **two** user IDs and called `notFound()` when only one was provided → **404**.",
    "",
    "## Trust Network card audit (runtime targets)",
    "",
    "| Card | Component | href | Route | Page file | Status |",
    "|------|-----------|------|-------|-----------|--------|",
  ];

  for (const row of trustRows) {
    reportLines.push(
      `| ${row.card.title} | \`${row.component}\` | \`${row.href}\` | \`${row.routePushed}\` | \`${row.pageFile ?? "MISSING"}\` | ${row.ok ? "OK" : "BROKEN"} |`
    );
  }

  reportLines.push(
    "",
    "## Fixes applied",
    "",
    "| Card | Was | Now | Verified destination |",
    "|------|-----|-----|----------------------|",
    "| Introduction Network | `/introductions` (no scroll) | `/introductions#introductions-list` | `app/(main)/introductions/page.tsx` |",
    "| Mutual Introductions | `/introductions/network?users={id}` (**404**) | `/introductions/mutual` | `app/(main)/introductions/mutual/page.tsx` |",
    "| People Connected Through You | `/introductions/network?users={id}` (**404**) | `/introductions/sent` | `app/(main)/introductions/sent/page.tsx` |",
    "| People Connected To You | `/introductions/network?users={id}` (**404**) | `/introductions` | `app/(main)/introductions/page.tsx` |",
    "| Connection Paths | `/discoveries` | `/discoveries` (unchanged) | `app/(main)/discoveries/page.tsx` |",
    "",
    "Additional hardening:",
    "",
    "- `/introductions/network` redirects to `/introductions` when fewer than two user IDs (no more 404).",
    "- Mutual partner cards link to `/introductions/network?users={viewer},{other}` (valid pair).",
    "- Single source of truth: `lib/introduction-routes.ts` → `TRUST_NETWORK_CARDS`.",
    "",
    "## Verification",
    "",
    "```bash",
    "npm run audit:navigation",
    "npm run build",
    "```",
    ""
  );

  fs.writeFileSync(
    path.join(ROOT, "docs", "INTRODUCTIONS_NAVIGATION_FIX_REPORT.md"),
    reportLines.join("\n")
  );

  const failed = brokenTrust.length + uniqueHrefIssues.length;
  if (failed) process.exit(1);
}

main();
