/**
 * Audit notification emitters and analytics events for wiring coverage.
 * Usage: npm run audit:events
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function readFile(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function extractAnalyticsMap(): Map<string, string> {
  const src = readFile("lib/analytics-events.ts");
  const map = new Map<string, string>();
  for (const m of src.matchAll(/(\w+):\s*"([^"]+)"/g)) {
    map.set(m[2], m[1]);
  }
  return map;
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsFiles(p, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function findCalls(name: string): number {
  let count = 0;
  for (const file of walkTsFiles(ROOT)) {
    if (file.includes("emitters.ts")) continue;
    const text = fs.readFileSync(file, "utf8");
    count += (text.match(new RegExp(`\\b${name}\\(`, "g")) ?? []).length;
  }
  return count;
}

function findTrackedEvents(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of walkTsFiles(ROOT)) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/eventType:\s*ANALYTICS_EVENTS\.(\w+)/g)) {
      counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    }
    for (const m of text.matchAll(/eventType:\s*"([^"]+)"/g)) {
      counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    }
  }
  return counts;
}

const emitters = [
  "notifyIntroductionReceived",
  "notifyMessageReceived",
  "notifyDiscoveryEngagement",
  "notifyInviteAccepted",
  "notifyInviteOpened",
  "notifyInviteRegistered",
  "notifyDiscoveryMessage",
  "notifyTrustScoreIncreased",
  "notifySharedIntroducerDiscovered",
  "notifyVerification",
];

const eventMap = extractAnalyticsMap();
const trackCounts = findTrackedEvents();

console.log("\n=== FriendIntro Event & Emitter Audit ===\n");

console.log("NOTIFICATION EMITTERS");
for (const e of emitters) {
  const calls = findCalls(e);
  console.log(`${calls > 0 ? "✓" : "✗"} ${e} — ${calls} call site(s)`);
}

console.log("\nANALYTICS EVENTS (27 defined)");
let wired = 0;
for (const [eventValue, constName] of eventMap) {
  const count =
    (trackCounts.get(constName) ?? 0) + (trackCounts.get(eventValue) ?? 0);
  if (count > 0) wired++;
  console.log(`${count > 0 ? "✓" : "✗"} ${eventValue} — ${count} track call(s)`);
}

console.log(`\nAnalytics wired: ${wired}/${eventMap.size}`);
console.log("\nManual persistence checks:");
console.log("  SELECT count(*) FROM notifications;");
console.log("  SELECT event_type, count(*) FROM analytics_events GROUP BY 1;");
