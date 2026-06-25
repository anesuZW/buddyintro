/**
 * Live performance audit — measures page and API response times.
 * Usage: npx tsx scripts/live-performance-audit.ts [--base http://localhost:3001]
 */
import { loadEnv } from "./audit-shared";

loadEnv();

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";

type Timed = { url: string; ms: number; status: number; size?: number };

async function timeFetch(path: string, init?: RequestInit): Promise<Timed> {
  const url = `${BASE.replace(/\/$/, "")}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, redirect: "manual" });
    const buf = await res.arrayBuffer();
    return { url: path, ms: Math.round(performance.now() - start), status: res.status, size: buf.byteLength };
  } catch (e) {
    return { url: path, ms: Math.round(performance.now() - start), status: 0 };
  }
}

const PAGES = [
  "/",
  "/login",
  "/home",
  "/introductions",
  "/discoveries",
  "/messages",
  "/notifications",
  "/profile",
  "/maindash",
];

const APIS = [
  "/api/health",
  "/api/feed",
  "/api/discoveries",
  "/api/introductions",
  "/api/messages",
  "/api/notifications",
  "/api/trust/recommendations",
  "/api/profile/insights",
  "/api/introduction-categories",
];

async function main() {
  console.log(`\n=== BuddyIntro Live Performance Audit ===`);
  console.log(`Base URL: ${BASE}\n`);

  console.log("--- Pages (unauthenticated / redirect) ---");
  const pageResults: Timed[] = [];
  for (const p of PAGES) {
    const r = await timeFetch(p);
    pageResults.push(r);
    const flag = r.ms > 500 ? " SLOW" : "";
    console.log(`${r.status} ${r.ms}ms ${r.size ?? 0}B ${p}${flag}`);
  }

  console.log("\n--- API routes (no session — expect 401/307) ---");
  const apiResults: Timed[] = [];
  for (const p of APIS) {
    const r = await timeFetch(p);
    apiResults.push(r);
    const flag = r.ms > 500 ? " SLOW" : "";
    console.log(`${r.status} ${r.ms}ms ${p}${flag}`);
  }

  const slow = [...pageResults, ...apiResults].filter((r) => r.ms > 500);
  console.log(`\nSlow (>500ms): ${slow.length}`);
  for (const s of slow.sort((a, b) => b.ms - a.ms)) {
    console.log(`  ${s.ms}ms ${s.url}`);
  }

  console.log("\nNote: Authenticated routes require browser session cookies for full measurement.");
}

main().catch(console.error);
