#!/usr/bin/env node
import { spawn } from "child_process";
import fs from "fs";
import { loadEnv, parseDbUrl } from "./load-env.mjs";

loadEnv();
const host = parseDbUrl(process.env.DATABASE_URL).host;
const OUT = "docs/performance/db-forensics/artifacts";
fs.mkdirSync(OUT, { recursive: true });

function run(cmd, args, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ cmd, args, timedOut: true, stdout, stderr });
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ cmd, args, code, stdout, stderr });
    });
  });
}

const results = { at: new Date().toISOString(), host, probes: {} };

// Windows ping
results.probes.ping = await run("ping", ["-n", "10", host]);
// traceroute
results.probes.tracert = await run("tracert", ["-d", "-h", "20", "-w", "2000", host], 180000);
// nslookup
results.probes.nslookup = await run("nslookup", [host]);

// Parse ping RTT if possible
const pingTimes = [...results.probes.ping.stdout.matchAll(/time[=<](\d+)ms/gi)].map((m) =>
  Number(m[1])
);
results.pingParsed = pingTimes.length
  ? {
      samples: pingTimes,
      min: Math.min(...pingTimes),
      max: Math.max(...pingTimes),
      mean: +(pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length).toFixed(1),
    }
  : { error: "no_rtt_parsed", stdoutTail: results.probes.ping.stdout.slice(-500) };

fs.writeFileSync(`${OUT}/network.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ host, pingParsed: results.pingParsed, codes: {
  ping: results.probes.ping.code,
  tracert: results.probes.tracert.code,
  nslookup: results.probes.nslookup.code,
} }, null, 2));
console.log("\n--- ping stdout ---\n" + results.probes.ping.stdout);
console.log("\n--- tracert stdout (tail) ---\n" + results.probes.tracert.stdout.slice(-2500));
