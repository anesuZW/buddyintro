#!/usr/bin/env node
/**
 * Measure TTFB + cache headers + Content-Encoding on a running server.
 * Usage: node .../measure-runtime.mjs --base=http://127.0.0.1:3050 --label=after
 */
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";

const base =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ||
  "http://127.0.0.1:3050";
const label =
  process.argv.find((a) => a.startsWith("--label="))?.split("=")[1] || "after";
const cookie =
  process.argv.find((a) => a.startsWith("--cookie="))?.slice("--cookie=".length) ||
  process.env.AUDIT_COOKIE ||
  "";

const pages = ["/login", "/home", "/discoveries", "/messages", "/profile"];

function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const started = Date.now();
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          Accept: "text/html",
          "Accept-Encoding": "gzip, deflate, br",
          ...headers,
        },
      },
      (res) => {
        const ttfb = Date.now() - started;
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            ttfbMs: ttfb,
            bytes: Buffer.concat(chunks).length,
            contentEncoding: res.headers["content-encoding"] || null,
            cacheControl: res.headers["cache-control"] || null,
            contentType: res.headers["content-type"] || null,
            location: res.headers.location || null,
            xPoweredBy: res.headers["x-powered-by"] || null,
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error("timeout"));
    });
    req.end();
  });
}

async function main() {
  const headers = cookie ? { Cookie: cookie } : {};
  const results = {};
  for (const page of pages) {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      samples.push(await request(`${base}${page}`, headers));
    }
    const ok = samples.filter((s) => s.status && s.status < 500);
    const ttfbs = ok.map((s) => s.ttfbMs).sort((a, b) => a - b);
    results[page] = {
      samples,
      medianTtfbMs: ttfbs[Math.floor(ttfbs.length / 2)] ?? null,
      status: samples.map((s) => s.status),
      contentEncoding: samples[samples.length - 1]?.contentEncoding,
      xPoweredBy: samples[samples.length - 1]?.xPoweredBy,
    };
  }

  // Probe a hashed static asset if present
  let staticProbe = null;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), ".next/build-manifest.json"), "utf8")
    );
    const poly = (manifest.polyfillFiles || []).find((f) => f.endsWith(".js"));
    if (poly) {
      const url = `${base}/_next/${poly.replace(/^static\//, "static/")}`;
      const fixed = poly.startsWith("static/")
        ? `${base}/_next/${poly}`
        : `${base}/_next/static/${poly}`;
      staticProbe = await request(fixed.startsWith("http") ? (poly.startsWith("static/") ? `${base}/_next/${poly}` : fixed) : fixed);
      staticProbe.url = poly.startsWith("static/")
        ? `${base}/_next/${poly}`
        : fixed;
    }
  } catch {
    /* ignore */
  }

  const outDir = path.join(
    process.cwd(),
    "docs/performance/production-speed/artifacts"
  );
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    label,
    base,
    measuredAt: new Date().toISOString(),
    pages: results,
    staticProbe,
  };
  const outPath = path.join(outDir, `runtime-${label}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
