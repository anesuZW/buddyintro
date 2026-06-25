/**

 * Scans internal navigation targets and compares them to Next.js App Router pages.

 * Usage: npm run audit:routes

 */

import fs from "fs";

import path from "path";



const ROOT = process.cwd();

const SCAN_DIRS = ["app", "components", "lib", "hooks", "services"].map((d) =>

  path.join(ROOT, d)

);



type RouteInfo = { pattern: string; file: string };



type NavRef = {

  routePattern: string;

  source: string;

  raw: string;

  kind: "static" | "dynamic" | "helper";

};



const HELPER_ROUTE_MAP: Record<string, string> = {

  introductionDetailHref: "/introductions/[param]",

  introductionStoryViewerHref: "/stories/view/[param]",

  introductionNetworkHref: "/introductions/network",

  notificationHref: "dynamic",

};



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



function normalizeStaticHref(raw: string): string | null {

  const href = raw.trim();

  if (!href.startsWith("/")) return null;

  if (href.startsWith("//")) return null;

  if (href.startsWith("/api/")) return null;

  const withoutQuery = href.split("?")[0].split("#")[0];

  if (!withoutQuery || withoutQuery === "/") return "/";

  return withoutQuery.replace(/\/+$/, "") || "/";

}



function segmentsToPattern(segments: string[]): string {

  return (

    "/" +

    segments

      .filter(Boolean)

      .map((seg) => {

        if (/^[0-9a-f-]{36}$/i.test(seg)) return "[param]";

        if (/^[0-9a-f]{24}$/i.test(seg)) return "[param]";

        if (/^\d+$/.test(seg)) return "[param]";

        return seg;

      })

      .join("/")

  );

}



function templatePrefixToPattern(prefix: string): string {
  const pathOnly = prefix.split("?")[0];
  const clean = pathOnly.replace(/\/+$/, "");
  if (!clean) return "/";
  const parts = clean.split("/").filter(Boolean);
  if (!parts.length) return "/";
  const dynamicInPath = parts.some((p) => p.includes("${"));
  if (dynamicInPath) {
    return segmentsToPattern(parts.map((p) => (p.includes("${") ? "[param]" : p)));
  }
  return segmentsToPattern(parts.concat("[param]"));
}

function templatePathOnlyPattern(prefix: string): string {
  const pathOnly = prefix.split("?")[0].replace(/\/+$/, "") || "/";
  const parts = pathOnly.split("/").filter(Boolean);
  return parts.length ? segmentsToPattern(parts) : "/";
}



function routeMatches(hrefPattern: string, routePattern: string): boolean {

  const h = hrefPattern.replace(/^\//, "");

  const r = routePattern.replace(/^\//, "");

  if (h === r) return true;

  const hParts = h.split("/");

  const rParts = r.split("/");

  if (hParts.length !== rParts.length) return false;

  return hParts.every((p, i) => p === rParts[i] || rParts[i] === "[param]");

}



function extractNavRefs(content: string, file: string): NavRef[] {

  const refs: NavRef[] = [];

  const rel = path.relative(ROOT, file);



  const staticPatterns = [

    /href=["'](\/[^"'#?]+)["']/g,

    /href=\{["'](\/[^"'#?]+)["']\}/g,

    /href=\{`(\/[^`$?]+)`\}/g,

    /redirect\(["'](\/[^"'#?]+)["']\)/g,

    /redirect\(`(\/[^`$?]+)`\)/g,

  ];



  for (const re of staticPatterns) {

    let m: RegExpExecArray | null;

    while ((m = re.exec(content))) {

      const norm = normalizeStaticHref(m[1]);

      if (!norm) continue;

      refs.push({

        routePattern: segmentsToPattern(norm.split("/").filter(Boolean)),

        source: rel,

        raw: m[1],

        kind: "static",

      });

    }

  }



  const templatePatterns = [

    /href=\{`(\/[^`$]+)\$\{/g,

    /href=\{\s*`(\/[^`$]+)\$\{/g,

    /redirect\(`(\/[^`$]+)\$\{/g,

  ];

  for (const re of templatePatterns) {

    let m: RegExpExecArray | null;

    while ((m = re.exec(content))) {
      const prefix = m[1];
      const routePattern = prefix.includes("?")
        ? templatePathOnlyPattern(prefix)
        : templatePrefixToPattern(prefix);
      refs.push({
        routePattern,
        source: rel,
        raw: `${prefix}\${...}`,
        kind: "dynamic",
      });
    }

  }



  for (const [helper, pattern] of Object.entries(HELPER_ROUTE_MAP)) {

    const re = new RegExp(`${helper}\\(`, "g");

    if (re.test(content)) {

      refs.push({

        routePattern: pattern === "dynamic" ? "/notifications" : pattern,

        source: rel,

        raw: `${helper}(...)`,

        kind: "helper",

      });

    }

  }



  const notificationStoryRe = /case\s+"story":\s*\n\s*return\s+`(\/[^`]+)`/g;

  let nm: RegExpExecArray | null;

  while ((nm = notificationStoryRe.exec(content))) {

    refs.push({

      routePattern: templatePrefixToPattern(nm[1].replace(/\$\{entityId\}/, "")),

      source: rel,

      raw: nm[1],

      kind: "helper",

    });

  }



  return refs;

}



function writeReport(args: {

  routes: RouteInfo[];

  refs: NavRef[];

  broken: NavRef[];

  matched: NavRef[];

}) {

  const lines: string[] = [

    "# Route Audit Report",

    "",

    `Generated: ${new Date().toISOString()}`,

    "",

    "## Summary",

    "",

    `- App routes: ${args.routes.length}`,

    `- Navigation references scanned: ${args.refs.length}`,

    `- Matched: ${args.matched.length}`,

    `- Broken: ${args.broken.length}`,

    "",

    "## Key introduction routes",

    "",

  ];



  for (const key of [

    "/introductions",

    "/introductions/[param]",

    "/introductions/network",

    "/stories/view/[param]",

    "/stories/[param]",

  ]) {

    const hit = args.routes.find((r) => r.pattern === key);

    lines.push(`- ${hit ? "✓" : "✗"} \`${key}\`${hit ? ` → ${hit.file}` : ""}`);

  }



  lines.push("", "## Broken routes", "");

  if (!args.broken.length) {

    lines.push("None found.");

  } else {

    for (const b of args.broken) {

      lines.push(`- \`${b.routePattern}\` (${b.kind}) in \`${b.source}\` — \`${b.raw}\``);

    }

  }



  lines.push("", "## Introduction navigation sources", "");

  const introRefs = args.refs.filter(

    (r) =>

      r.routePattern.startsWith("/introductions") ||

      r.raw.includes("introductionDetailHref") ||

      r.raw.includes("notificationHref")

  );

  for (const r of introRefs) {

    const ok = !args.broken.includes(r);

    lines.push(`- ${ok ? "✓" : "✗"} \`${r.routePattern}\` — \`${r.source}\``);

  }



  fs.writeFileSync(path.join(ROOT, "docs", "ROUTE_AUDIT_REPORT.md"), lines.join("\n"));

}



function main() {

  const routes = collectAppRoutes();

  const routePatterns = routes.map((r) => r.pattern);



  const allRefs: NavRef[] = [];

  for (const dir of SCAN_DIRS) {

    walk(dir, (file) => {

      if (file.includes("audit-routes.ts")) return;

      const content = fs.readFileSync(file, "utf8");

      allRefs.push(...extractNavRefs(content, file));

    });

  }



  const broken: NavRef[] = [];

  const matched: NavRef[] = [];



  for (const ref of allRefs) {

    if (ref.kind === "helper" && ref.raw.includes("notificationHref")) {

      matched.push(ref);

      continue;

    }

    const ok = routePatterns.some((r) => routeMatches(ref.routePattern.replace(/^\//, ""), r.replace(/^\//, "")));

    if (ok) matched.push(ref);

    else broken.push(ref);

  }



  const uniqueBroken = [...new Map(broken.map((b) => [b.routePattern + b.source, b])).values()];



  console.log("\n=== FriendIntro Route Audit ===\n");

  console.log(`App routes discovered: ${routes.length}`);

  console.log(`Navigation references scanned: ${allRefs.length}`);

  console.log(`Matched: ${matched.length}`);

  console.log(`Broken: ${uniqueBroken.length}\n`);



  if (uniqueBroken.length) {

    console.log("BROKEN ROUTES:");

    for (const b of uniqueBroken) {

      console.log(`  ✗ ${b.routePattern} (${b.kind})`);

      console.log(`      ${b.source} — ${b.raw}`);

    }

    console.log("");

  } else {

    console.log("✓ No broken routes found\n");

  }



  console.log("Key introduction routes:");

  for (const key of [

    "/introductions",

    "/introductions/[param]",

    "/introductions/network",

    "/stories/view/[param]",

  ]) {

    const hit = routes.find((r) => r.pattern === key);

    console.log(`  ${hit ? "✓" : "✗"} ${key}${hit ? ` (${hit.file})` : ""}`);

  }



  writeReport({ routes, refs: allRefs, broken: uniqueBroken, matched });



  if (uniqueBroken.length) process.exit(1);

}



main();


