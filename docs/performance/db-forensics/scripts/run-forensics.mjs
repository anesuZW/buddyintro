#!/usr/bin/env node
/**
 * DB connection forensics — measure DNS / TCP / TLS / pg / Prisma stages.
 * Read-only. Does not modify application code.
 */
import dns from "dns";
import net from "net";
import tls from "tls";
import fs from "fs";
import { performance } from "perf_hooks";
import { loadEnv, parseDbUrl, redactUrl } from "./load-env.mjs";

loadEnv();

const dnsPromises = dns.promises;
const OUT_DIR = "docs/performance/db-forensics/artifacts";
fs.mkdirSync(OUT_DIR, { recursive: true });

function hr() {
  return process.hrtime.bigint();
}
function msSince(start) {
  return Number(hr() - start) / 1e6;
}
function stats(samples) {
  const a = [...samples].filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const sum = a.reduce((s, n) => s + n, 0);
  const pct = (p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
  return {
    n: a.length,
    min: +a[0].toFixed(3),
    median: +pct(50).toFixed(3),
    p95: +pct(95).toFixed(3),
    p99: +pct(99).toFixed(3),
    max: +a[a.length - 1].toFixed(3),
    mean: +(sum / a.length).toFixed(3),
    samples: a.map((n) => +n.toFixed(3)),
  };
}

function getUrlMeta(key = "DATABASE_URL") {
  const raw = process.env[key];
  if (!raw) throw new Error(`${key} missing`);
  return { raw, meta: parseDbUrl(raw), redacted: redactUrl(raw) };
}

async function measureDns(host, runs = 5) {
  const lookup4 = [];
  const lookup6 = [];
  const resolve4 = [];
  const resolve6 = [];
  let addresses = { v4: [], v6: [] };

  for (let i = 0; i < runs; i++) {
    const t0 = hr();
    try {
      const r = await dnsPromises.lookup(host, { family: 4 });
      lookup4.push(msSince(t0));
      if (i === 0) addresses.v4.push(r.address);
    } catch (e) {
      lookup4.push(NaN);
      if (i === 0) addresses.v4Error = e.code || e.message;
    }

    const t1 = hr();
    try {
      const r = await dnsPromises.lookup(host, { family: 6 });
      lookup6.push(msSince(t1));
      if (i === 0) addresses.v6.push(r.address);
    } catch (e) {
      lookup6.push(NaN);
      if (i === 0) addresses.v6Error = e.code || e.message;
    }

    const t2 = hr();
    try {
      const r = await dnsPromises.resolve4(host);
      resolve4.push(msSince(t2));
      if (i === 0) addresses.v4 = [...new Set([...addresses.v4, ...r])];
    } catch (e) {
      resolve4.push(NaN);
      if (i === 0) addresses.resolve4Error = e.code || e.message;
    }

    const t3 = hr();
    try {
      const r = await dnsPromises.resolve6(host);
      resolve6.push(msSince(t3));
      if (i === 0) addresses.v6 = [...new Set([...addresses.v6, ...r])];
    } catch (e) {
      resolve6.push(NaN);
      if (i === 0) addresses.resolve6Error = e.code || e.message;
    }
  }

  return {
    host,
    addresses,
    lookup4: stats(lookup4),
    lookup6: stats(lookup6),
    resolve4: stats(resolve4),
    resolve6: stats(resolve6),
  };
}

function tcpConnect(host, port, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = hr();
    const socket = net.connect({ host, port });
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      finish({
        ok: true,
        tcpMs: msSince(start),
        localAddress: socket.localAddress,
        remoteAddress: socket.remoteAddress,
      });
    });
    socket.on("timeout", () => finish({ ok: false, tcpMs: msSince(start), error: "TIMEOUT" }));
    socket.on("error", (e) =>
      finish({ ok: false, tcpMs: msSince(start), error: e.code || e.message })
    );
  });
}

function tlsHandshake(host, port, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const wallStart = hr();
    let tcpMs = null;
    let tlsMs = null;
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      tcpMs = msSince(wallStart);
      const tlsStart = hr();
      const secure = tls.connect(
        {
          socket,
          servername: host,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
        },
        () => {
          tlsMs = msSince(tlsStart);
          const totalMs = msSince(wallStart);
          finish({
            ok: true,
            tcpMs,
            tlsMs,
            totalConnectMs: totalMs,
            protocol: secure.getProtocol?.(),
            alpn: secure.alpnProtocol || null,
            authorized: secure.authorized,
            authorizationError: secure.authorizationError || null,
            cipher: secure.getCipher?.(),
            reused: secure.isSessionReused?.() ?? null,
            cert: (() => {
              const c = secure.getPeerCertificate?.();
              if (!c) return null;
              return {
                subject: c.subject,
                issuer: c.issuer?.O || c.issuer?.CN,
                valid_from: c.valid_from,
                valid_to: c.valid_to,
              };
            })(),
          });
        }
      );
      secure.on("error", (e) =>
        finish({
          ok: false,
          tcpMs,
          tlsMs: msSince(tlsStart),
          totalConnectMs: msSince(wallStart),
          error: e.code || e.message,
        })
      );
    });
    socket.on("timeout", () =>
      finish({ ok: false, tcpMs, totalConnectMs: msSince(wallStart), error: "TIMEOUT" })
    );
    socket.on("error", (e) =>
      finish({
        ok: false,
        tcpMs,
        totalConnectMs: msSince(wallStart),
        error: e.code || e.message,
      })
    );
  });
}

async function measureTcpTls(host, port, runs = 5) {
  const tcp = [];
  const tls = [];
  const total = [];
  let lastDetail = null;
  for (let i = 0; i < runs; i++) {
    const t = await tcpConnect(host, port);
    if (t.ok) tcp.push(t.tcpMs);
    else tcp.push(NaN);

    const s = await tlsHandshake(host, port);
    lastDetail = s;
    if (s.ok) {
      tls.push(s.tlsMs);
      total.push(s.totalConnectMs);
    } else {
      tls.push(NaN);
      total.push(NaN);
    }
  }
  return {
    host,
    port,
    tcp: stats(tcp),
    tlsHandshake: stats(tls),
    tcpPlusTls: stats(total),
    lastDetail,
  };
}

async function measurePgStages(rawUrl, label, { runs = 5, reuseClient = false } = {}) {
  const pg = await import("pg");
  const { Client } = pg.default || pg;
  const results = [];

  if (reuseClient) {
    const constructStart = hr();
    const client = new Client({ connectionString: rawUrl, connectionTimeoutMillis: 30000 });
    const constructMs = msSince(constructStart);
    const connectStart = hr();
    await client.connect();
    const connectMs = msSince(connectStart);

    for (let i = 0; i < runs; i++) {
      const qStart = hr();
      const res = await client.query({
        text: "SELECT NOW() AS now, clock_timestamp() AS clock",
        // also ask server for duration if available via EXPLAIN later
      });
      const queryMs = msSince(qStart);
      results.push({
        i,
        constructMs: i === 0 ? constructMs : 0,
        connectMs: i === 0 ? connectMs : 0,
        queryMs,
        row: res.rows[0],
      });
    }
    const d0 = hr();
    await client.end();
    const disconnectMs = msSince(d0);
    return {
      label,
      mode: "reuseClient",
      disconnectMs,
      connectMs,
      constructMs,
      queries: results,
      queryStats: stats(results.map((r) => r.queryMs)),
    };
  }

  // new client each run
  for (let i = 0; i < runs; i++) {
    const constructStart = hr();
    const client = new Client({ connectionString: rawUrl, connectionTimeoutMillis: 30000 });
    const constructMs = msSince(constructStart);
    const connectStart = hr();
    await client.connect();
    const connectMs = msSince(connectStart);
    const qStart = hr();
    const res = await client.query("SELECT NOW() AS now");
    const queryMs = msSince(qStart);
    const d0 = hr();
    await client.end();
    const disconnectMs = msSince(d0);
    results.push({ i, constructMs, connectMs, queryMs, disconnectMs, row: res.rows[0] });
  }
  return {
    label,
    mode: "newClientEachRun",
    queries: results,
    connectStats: stats(results.map((r) => r.connectMs)),
    queryStats: stats(results.map((r) => r.queryMs)),
    totalStats: stats(results.map((r) => r.constructMs + r.connectMs + r.queryMs + r.disconnectMs)),
  };
}

async function measureExplain(rawUrl) {
  const pg = await import("pg");
  const { Client } = pg.default || pg;
  const client = new Client({ connectionString: rawUrl, connectionTimeoutMillis: 30000 });
  const connectStart = hr();
  await client.connect();
  const connectMs = msSince(connectStart);
  const qStart = hr();
  const res = await client.query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT NOW()");
  const queryMs = msSince(qStart);
  await client.end();
  const plan = res.rows[0]["QUERY PLAN"]?.[0] || res.rows[0]["QUERY PLAN"] || res.rows[0];
  return { connectMs, queryMs, plan };
}

async function measurePrisma(rawUrl) {
  // Ensure Prisma uses the URL under test
  process.env.DATABASE_URL = rawUrl;
  const constructStart = hr();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: [{ emit: "event", level: "query" }],
  });
  const constructMs = msSince(constructStart);

  const queryEvents = [];
  prisma.$on("query", (e) => {
    queryEvents.push({
      query: e.query,
      durationMs: e.duration,
      params: e.params,
    });
  });

  const sameClient = [];
  for (let i = 0; i < 5; i++) {
    const t0 = hr();
    await prisma.$queryRaw`SELECT NOW()`;
    sameClient.push(msSince(t0));
  }

  await prisma.$disconnect();

  // New client each of 3 runs
  const newClient = [];
  for (let i = 0; i < 3; i++) {
    const c0 = hr();
    const p = new PrismaClient();
    const construct = msSince(c0);
    const q0 = hr();
    await p.$queryRaw`SELECT NOW()`;
    const query = msSince(q0);
    const d0 = hr();
    await p.$disconnect();
    newClient.push({ constructMs: construct, queryMs: query, disconnectMs: msSince(d0) });
  }

  // Parallel same-process: 5 clients in parallel (each connect)
  const parallelStart = hr();
  const parallel = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const p = new PrismaClient();
      const t0 = hr();
      await p.$queryRaw`SELECT NOW()`;
      const queryMs = msSince(t0);
      await p.$disconnect();
      return queryMs;
    })
  );
  const parallelWallMs = msSince(parallelStart);

  return {
    constructMs,
    sameClient: stats(sameClient),
    sameClientSamples: sameClient,
    prismaQueryEventDurations: queryEvents.map((e) => e.durationMs),
    newClient,
    parallel: { wallMs: parallelWallMs, perClient: stats(parallel), samples: parallel },
  };
}

async function main() {
  const db = getUrlMeta("DATABASE_URL");
  const direct = process.env.DIRECT_URL
    ? { raw: process.env.DIRECT_URL, meta: parseDbUrl(process.env.DIRECT_URL), redacted: redactUrl(process.env.DIRECT_URL) }
    : null;

  console.log("=== URL inspect ===");
  console.log(JSON.stringify({ database: db.redacted, meta: db.meta, direct: direct?.redacted }, null, 2));

  console.log("\n=== DNS ===");
  const dnsResult = await measureDns(db.meta.host, 8);
  console.log(JSON.stringify(dnsResult, null, 2));
  fs.writeFileSync(`${OUT_DIR}/dns.json`, JSON.stringify(dnsResult, null, 2));

  if (direct?.meta?.host && direct.meta.host !== db.meta.host) {
    try {
      const directDns = await measureDns(direct.meta.host, 3);
      fs.writeFileSync(`${OUT_DIR}/dns-direct.json`, JSON.stringify(directDns, null, 2));
    } catch (e) {
      fs.writeFileSync(
        `${OUT_DIR}/dns-direct.json`,
        JSON.stringify({ error: e.message }, null, 2)
      );
    }
  }

  console.log("\n=== TCP / TLS ===");
  const tcpTls = await measureTcpTls(db.meta.host, db.meta.port, 5);
  console.log(JSON.stringify(tcpTls, null, 2));
  fs.writeFileSync(`${OUT_DIR}/tcp-tls.json`, JSON.stringify(tcpTls, null, 2));

  console.log("\n=== pg new client each run ===");
  const pgNew = await measurePgStages(db.raw, "DATABASE_URL", { runs: 5, reuseClient: false });
  console.log(JSON.stringify(pgNew, null, 2));
  fs.writeFileSync(`${OUT_DIR}/pg-new-client.json`, JSON.stringify(pgNew, null, 2));

  console.log("\n=== pg reuse client ===");
  const pgReuse = await measurePgStages(db.raw, "DATABASE_URL", { runs: 10, reuseClient: true });
  console.log(JSON.stringify(pgReuse, null, 2));
  fs.writeFileSync(`${OUT_DIR}/pg-reuse-client.json`, JSON.stringify(pgReuse, null, 2));

  console.log("\n=== EXPLAIN ANALYZE ===");
  let explain;
  try {
    explain = await measureExplain(db.raw);
    console.log(JSON.stringify(explain, null, 2));
  } catch (e) {
    explain = { error: e.message };
    console.log(explain);
  }
  fs.writeFileSync(`${OUT_DIR}/explain.json`, JSON.stringify(explain, null, 2));

  console.log("\n=== Prisma ===");
  const prismaResult = await measurePrisma(db.raw);
  console.log(JSON.stringify(prismaResult, null, 2));
  fs.writeFileSync(`${OUT_DIR}/prisma.json`, JSON.stringify(prismaResult, null, 2));

  // Timeline decomposition from medians
  const dnsMed = dnsResult.lookup4?.median ?? null;
  const tcpMed = tcpTls.tcp?.median ?? null;
  const tlsMed = tcpTls.tlsHandshake?.median ?? null;
  const connectMed = pgNew.connectStats?.median ?? null;
  const warmQueryMed = pgReuse.queryStats?.median ?? null;
  const coldTotalMed = pgNew.totalStats?.median ?? null;
  const prismaFirst = prismaResult.sameClientSamples?.[0] ?? null;
  const prismaWarmMed = prismaResult.sameClient?.median ?? null;

  const timeline = {
    at: new Date().toISOString(),
    target: db.redacted,
    host: db.meta.host,
    port: db.meta.port,
    measured_ms: {
      dns_lookup4_median: dnsMed,
      tcp_connect_median: tcpMed,
      tls_handshake_median: tlsMed,
      tcp_plus_tls_median: tcpTls.tcpPlusTls?.median ?? null,
      pg_connect_new_client_median: connectMed,
      pg_query_warm_reuse_median: warmQueryMed,
      pg_full_new_client_cycle_median: coldTotalMed,
      prisma_first_query_after_construct: prismaFirst,
      prisma_same_client_median: prismaWarmMed,
      prisma_event_duration_first: prismaResult.prismaQueryEventDurations?.[0] ?? null,
    },
    note:
      "pg connect includes DNS+TCP+TLS+Postgres startup/auth as seen by libpq/pg. " +
      "Warm query on reused client approximates RTT + server exec without new handshake.",
  };
  fs.writeFileSync(`${OUT_DIR}/timeline-summary.json`, JSON.stringify(timeline, null, 2));
  console.log("\n=== TIMELINE SUMMARY ===");
  console.log(JSON.stringify(timeline, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
