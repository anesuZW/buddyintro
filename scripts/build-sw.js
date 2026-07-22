#!/usr/bin/env node
/**
 * Build production service worker with Workbox injectManifest.
 * Copies self-hosted Workbox runtime to public/workbox/.
 */
const { injectManifest } = require("workbox-build");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const WORKBOX_SRC = path.join(ROOT, "node_modules", "workbox-sw", "build");
const WORKBOX_DEST = path.join(PUBLIC, "workbox");

function copyWorkboxRuntime() {
  const modulesDir = path.join(ROOT, "node_modules");
  if (!fs.existsSync(modulesDir)) {
    console.warn("⚠ node_modules missing — run npm install");
    return false;
  }

  fs.mkdirSync(WORKBOX_DEST, { recursive: true });

  // workbox-sw loader
  if (fs.existsSync(WORKBOX_SRC)) {
    for (const file of fs.readdirSync(WORKBOX_SRC)) {
      if (file.endsWith(".js") || file.endsWith(".mjs")) {
        fs.copyFileSync(path.join(WORKBOX_SRC, file), path.join(WORKBOX_DEST, file));
      }
    }
  }

  // Self-hosted Workbox modules (required when modulePathPrefix is /workbox/)
  for (const pkg of fs.readdirSync(modulesDir)) {
    if (!pkg.startsWith("workbox-") || pkg === "workbox-sw" || pkg === "workbox-build") continue;
    const buildDir = path.join(modulesDir, pkg, "build");
    if (!fs.existsSync(buildDir)) continue;
    for (const file of fs.readdirSync(buildDir)) {
      if (file.endsWith(".prod.js") || file.endsWith(".dev.js")) {
        fs.copyFileSync(path.join(buildDir, file), path.join(WORKBOX_DEST, file));
      }
    }
  }

  return true;
}

function collectAdditionalPrecache() {
  const entries = [
    { url: "/offline.html", revision: null },
    { url: "/icons/icon-192.png", revision: null },
    { url: "/icons/icon-512.png", revision: null },
    { url: "/icons/icon-512.svg", revision: null },
    { url: "/icons/apple-touch-icon.png", revision: null },
    { url: "/favicon.ico", revision: null },
  ];

  let buildVersion = "dev";
  const buildIdPath = path.join(ROOT, ".next", "BUILD_ID");
  if (fs.existsSync(buildIdPath)) {
    buildVersion = fs.readFileSync(buildIdPath, "utf8").trim();
  }

  entries.forEach((e) => {
    if (e.revision === null) e.revision = buildVersion;
  });
  return entries;
}

async function main() {
  copyWorkboxRuntime();

  const nextStatic = path.join(ROOT, ".next", "static");
  const globDirectory = fs.existsSync(nextStatic) ? nextStatic : PUBLIC;
  const globPatterns =
    globDirectory === nextStatic
      ? ["**/*.{js,css,woff2}"]
      : ["icons/**/*.{png,svg,ico}", "offline.html", "**/*.{js,css}"];

  const additionalManifestEntries = collectAdditionalPrecache();

  const result = await injectManifest({
    swSrc: path.join(ROOT, "scripts", "pwa", "sw-source.js"),
    swDest: path.join(PUBLIC, "sw.js"),
    globDirectory,
    globPatterns,
    globIgnores: ["**/sw.js", "**/workbox/**", "**/.DS_Store"],
    additionalManifestEntries,
    modifyURLPrefix:
      globDirectory === nextStatic
        ? {
            "": "/_next/static/",
          }
        : undefined,
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  });

  if (result.errors?.length) {
    console.error("Service worker build errors:", result.errors);
    process.exit(1);
  }

  console.log(
    `✓ public/sw.js (${result.count ?? result.filePaths?.length ?? 0} precache entries, ${Math.round((result.size ?? 0) / 1024)} KiB)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
