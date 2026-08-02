#!/usr/bin/env node
import net from "net";
import dns from "dns";
import fs from "fs";
import { loadEnv, parseDbUrl } from "./load-env.mjs";

loadEnv();
const host = parseDbUrl(process.env.DATABASE_URL).host;
const port = 5432;
const OUT = "docs/performance/db-forensics/artifacts";

function hr() {
  return process.hrtime.bigint();
}
function msSince(s) {
  return Number(hr() - s) / 1e6;
}
function stats(samples) {
  const a = [...samples].sort((x, y) => x - y);
  const pct = (p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
  return {
    n: a.length,
    min: +a[0].toFixed(3),
    median: +pct(50).toFixed(3),
    max: +a[a.length - 1].toFixed(3),
    mean: +(a.reduce((s, n) => s + n, 0) / a.length).toFixed(3),
    samples: a.map((n) => +n.toFixed(3)),
  };
}

function tcpConnect(opts) {
  return new Promise((resolve) => {
    const t0 = hr();
    const s = net.connect({ port, ...opts });
    s.setTimeout(15000);
    const done = (o) => {
      try {
        s.destroy();
      } catch {
        /* ignore */
      }
      resolve(o);
    };
    s.on("connect", () =>
      done({
        ok: true,
        tcpMs: msSince(t0),
        remote: s.remoteAddress,
        local: s.localAddress,
      })
    );
    s.on("timeout", () => done({ ok: false, tcpMs: msSince(t0), error: "TIMEOUT" }));
    s.on("error", (e) => done({ ok: false, tcpMs: msSince(t0), error: e.code || e.message }));
  });
}

const modes = [
  { name: "hostname_default", opts: { host } },
  { name: "hostname_family4", opts: { host, family: 4 } },
  { name: "hostname_autoSelectFamily_false", opts: { host, autoSelectFamily: false } },
  { name: "hostname_family4_autoSelectFamily_false", opts: { host, family: 4, autoSelectFamily: false } },
];

const results = { at: new Date().toISOString(), host, port, modes: {} };

for (const mode of modes) {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const r = await tcpConnect(mode.opts);
    samples.push(r);
    console.log(mode.name, JSON.stringify(r));
  }
  results.modes[mode.name] = {
    runs: samples,
    stats: stats(samples.filter((s) => s.ok).map((s) => s.tcpMs)),
  };
}

const ip = (await dns.promises.lookup(host, { family: 4 })).address;
const ipSamples = [];
for (let i = 0; i < 5; i++) {
  const r = await tcpConnect({ host: ip });
  ipSamples.push(r);
  console.log("ip_direct", JSON.stringify(r));
}
results.modes.ip_direct = {
  ip,
  runs: ipSamples,
  stats: stats(ipSamples.filter((s) => s.ok).map((s) => s.tcpMs)),
};

// getaddrinfo timing alone
const gai = [];
for (let i = 0; i < 5; i++) {
  const t0 = hr();
  await dns.promises.lookup(host, { all: true, verbatim: true });
  gai.push(msSince(t0));
}
results.getaddrinfo_all = stats(gai);

fs.writeFileSync(`${OUT}/tcp-hostname-penalty.json`, JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(results.modes).map(([k, v]) => [k, v.stats])
    ),
    null,
    2
  )
);
