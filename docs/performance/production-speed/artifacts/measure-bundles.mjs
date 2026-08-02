#!/usr/bin/env node
/**
 * Summarize production First Load JS from Next build manifests.
 * Usage: node docs/performance/production-speed/artifacts/measure-bundles.mjs [--label=after]
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const label =
  process.argv.find((a) => a.startsWith("--label="))?.split("=")[1] || "after";
const outDir = path.join(root, "docs/performance/production-speed/artifacts");
fs.mkdirSync(outDir, { recursive: true });

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function fileSize(rel) {
  const p = path.join(root, ".next", rel.replace(/^\//, ""));
  if (!fs.existsSync(p)) {
    const alt = path.join(root, ".next/static", rel.replace(/^static\//, ""));
    if (fs.existsSync(alt)) return fs.statSync(alt).size;
    return 0;
  }
  return fs.statSync(p).size;
}

function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJs(p, acc);
    else if (ent.name.endsWith(".js") && !ent.name.endsWith(".map")) acc.push(p);
  }
  return acc;
}

const staticFiles = walkJs(path.join(root, ".next/static"));
const totalStaticJs = staticFiles.reduce((s, f) => s + fs.statSync(f).size, 0);

const appManifestPath = path.join(root, ".next/app-build-manifest.json");
const buildManifestPath = path.join(root, ".next/build-manifest.json");
const appManifest = fs.existsSync(appManifestPath) ? readJson(appManifestPath) : {};
const buildManifest = fs.existsSync(buildManifestPath)
  ? readJson(buildManifestPath)
  : {};

const shared =
  (buildManifest.pages?.["/_app"] || buildManifest.rootMainFiles || []).filter(
    (f) => typeof f === "string" && f.endsWith(".js")
  );

function sumFiles(files) {
  let bytes = 0;
  const resolved = [];
  for (const f of files) {
    const candidates = [
      path.join(root, ".next", f),
      path.join(root, ".next/static", f.replace(/^static\//, "")),
      path.join(root, f),
    ];
    const hit = candidates.find((c) => fs.existsSync(c));
    const size = hit ? fs.statSync(hit).size : 0;
    bytes += size;
    resolved.push({ file: f, bytes: size });
  }
  return { bytes, files: resolved };
}

const routeKeys = Object.keys(appManifest.pages || {}).filter((k) =>
  /\/(home|discoveries|messages|profile|login|create-story)/.test(k)
);

const routes = {};
for (const key of routeKeys.length ? routeKeys : Object.keys(appManifest.pages || {})) {
  const pageFiles = (appManifest.pages[key] || []).filter((f) => f.endsWith(".js"));
  const all = [...new Set([...shared, ...pageFiles])];
  routes[key] = sumFiles(all);
}

const topChunks = staticFiles
  .map((f) => ({
    file: path.relative(path.join(root, ".next"), f).replace(/\\/g, "/"),
    bytes: fs.statSync(f).size,
  }))
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 25);

const result = {
  label,
  builtAt: new Date().toISOString(),
  buildId: fs.existsSync(path.join(root, ".next/BUILD_ID"))
    ? fs.readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim()
    : null,
  totalStaticJsBytes: totalStaticJs,
  totalStaticJsKB: Math.round(totalStaticJs / 1024),
  sharedFiles: shared,
  routes,
  topChunks,
};

const outPath = path.join(outDir, `bundle-${label}.json`);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  label,
  buildId: result.buildId,
  totalStaticJsKB: result.totalStaticJsKB,
  routeCount: Object.keys(routes).length,
  top5: topChunks.slice(0, 5).map((c) => ({
    file: c.file,
    kb: Math.round(c.bytes / 1024),
  })),
  outPath,
}, null, 2));
