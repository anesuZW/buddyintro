#!/usr/bin/env node
/**
 * Measure PostgreSQL connection stages with correct SSLRequest → TLS flow.
 * Stages: DNS → TCP → SSLRequest → TLS handshake → (optional) Startup/Auth via pg.
 */
import dns from "dns";
import net from "net";
import tls from "tls";
import fs from "fs";
import { loadEnv, parseDbUrl, redactUrl } from "./load-env.mjs";

loadEnv();
const dnsPromises = dns.promises;
const OUT = "docs/performance/db-forensics/artifacts";
fs.mkdirSync(OUT, { recursive: true });

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

/** PostgreSQL SSLRequest: int32 len=8, int32 code=80877103 */
function sslRequestPacket() {
  const buf = Buffer.alloc(8);
  buf.writeInt32BE(8, 0);
  buf.writeInt32BE(80877103, 4);
  return buf;
}

function measurePgSslHandshake(host, port, servername, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const wall = hr();
    let dnsMs = null;
    let tcpMs = null;
    let sslRequestMs = null;
    let tlsMs = null;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const tDns = hr();
    dnsPromises
      .lookup(host, { family: 4 })
      .then((r) => {
        dnsMs = msSince(tDns);
        const tTcp = hr();
        const socket = net.connect({ host: r.address, port });
        socket.setTimeout(timeoutMs);
        socket.on("timeout", () => {
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
          finish({
            ok: false,
            dnsMs,
            tcpMs,
            error: "TIMEOUT",
            totalMs: msSince(wall),
          });
        });
        socket.on("error", (e) =>
          finish({
            ok: false,
            dnsMs,
            tcpMs,
            error: e.code || e.message,
            totalMs: msSince(wall),
          })
        );
        socket.on("connect", () => {
          tcpMs = msSince(tTcp);
          const tSslReq = hr();
          socket.write(sslRequestPacket());
          socket.once("data", (chunk) => {
            sslRequestMs = msSince(tSslReq);
            const reply = chunk.toString("utf8", 0, 1);
            if (reply !== "S") {
              try {
                socket.destroy();
              } catch {
                /* ignore */
              }
              return finish({
                ok: false,
                dnsMs,
                tcpMs,
                sslRequestMs,
                sslReply: reply,
                error: "SERVER_REJECTED_SSL",
                totalMs: msSince(wall),
              });
            }
            // leftover after 'S' should be empty for SSLRequest; if not, uncommon
            const tTls = hr();
            const secure = tls.connect(
              {
                socket,
                servername: servername || host,
                rejectUnauthorized: true,
                minVersion: "TLSv1.2",
              },
              () => {
                tlsMs = msSince(tTls);
                const detail = {
                  ok: true,
                  dnsMs,
                  tcpMs,
                  sslRequestMs,
                  tlsMs,
                  totalHandshakeMs: msSince(wall),
                  protocol: secure.getProtocol?.(),
                  authorized: secure.authorized,
                  authorizationError: secure.authorizationError || null,
                  reused: secure.isSessionReused?.() ?? null,
                  cipher: secure.getCipher?.(),
                  certIssuer: (() => {
                    const c = secure.getPeerCertificate?.();
                    return c?.issuer?.O || c?.issuer?.CN || null;
                  })(),
                };
                try {
                  secure.destroy();
                } catch {
                  /* ignore */
                }
                finish(detail);
              }
            );
            secure.on("error", (e) => {
              try {
                secure.destroy();
              } catch {
                /* ignore */
              }
              finish({
                ok: false,
                dnsMs,
                tcpMs,
                sslRequestMs,
                tlsMs: msSince(tTls),
                error: e.code || e.message,
                totalMs: msSince(wall),
              });
            });
          });
        });
      })
      .catch((e) =>
        finish({ ok: false, error: e.code || e.message, totalMs: msSince(wall) })
      );
  });
}

async function measurePgConnectBreakdown(rawUrl, runs = 5) {
  const pg = await import("pg");
  const { Client } = pg.default || pg;
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const client = new Client({ connectionString: rawUrl, connectionTimeoutMillis: 30000 });
    const t0 = hr();
    await client.connect();
    const connectMs = msSince(t0);
    const t1 = hr();
    await client.query("SELECT 1");
    const queryMs = msSince(t1);
    const t2 = hr();
    await client.end();
    const endMs = msSince(t2);
    samples.push({ connectMs, queryMs, endMs });
  }
  return {
    connect: stats(samples.map((s) => s.connectMs)),
    query: stats(samples.map((s) => s.queryMs)),
    end: stats(samples.map((s) => s.endMs)),
    samples,
  };
}

async function tryPortVariant(baseUrl, port) {
  const u = new URL(baseUrl);
  u.port = String(port);
  const raw = u.toString();
  try {
    const result = await measurePgConnectBreakdown(raw, 3);
    return { port, ok: true, redacted: redactUrl(raw), ...result };
  } catch (e) {
    return { port, ok: false, redacted: redactUrl(raw), error: e.message };
  }
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL missing");
  const meta = parseDbUrl(raw);
  const host = meta.host;
  const port = meta.port || 5432;

  console.log("=== PG SSLRequest + TLS (5 runs) ===");
  const handshakeRuns = [];
  for (let i = 0; i < 5; i++) {
    const r = await measurePgSslHandshake(host, port, host);
    handshakeRuns.push(r);
    console.log(JSON.stringify(r));
  }
  const okRuns = handshakeRuns.filter((r) => r.ok);
  const handshakeSummary = {
    host,
    port,
    runs: handshakeRuns,
    dns: stats(okRuns.map((r) => r.dnsMs)),
    tcp: stats(okRuns.map((r) => r.tcpMs)),
    sslRequest: stats(okRuns.map((r) => r.sslRequestMs)),
    tls: stats(okRuns.map((r) => r.tlsMs)),
    totalHandshake: stats(okRuns.map((r) => r.totalHandshakeMs)),
  };
  fs.writeFileSync(`${OUT}/pg-ssl-handshake.json`, JSON.stringify(handshakeSummary, null, 2));

  console.log("\n=== pg connect breakdown (port from URL) ===");
  const primary = await measurePgConnectBreakdown(raw, 5);
  console.log(JSON.stringify(primary, null, 2));
  fs.writeFileSync(`${OUT}/pg-connect-breakdown.json`, JSON.stringify(primary, null, 2));

  console.log("\n=== port 6543 (transaction pooler, if allowed) ===");
  const p6543 = await tryPortVariant(raw, 6543);
  console.log(JSON.stringify(p6543, null, 2));
  fs.writeFileSync(`${OUT}/pg-port-6543.json`, JSON.stringify(p6543, null, 2));

  console.log("\n=== port 5432 explicit remeasure ===");
  const p5432 = await tryPortVariant(raw, 5432);
  fs.writeFileSync(`${OUT}/pg-port-5432.json`, JSON.stringify(p5432, null, 2));

  const derived = {
    at: new Date().toISOString(),
    note: "Auth/startup remainder = pg.connect − (dns+tcp+sslRequest+tls) when both measured on same path",
    handshake_medians_ms: {
      dns: handshakeSummary.dns?.median ?? null,
      tcp: handshakeSummary.tcp?.median ?? null,
      sslRequest: handshakeSummary.sslRequest?.median ?? null,
      tls: handshakeSummary.tls?.median ?? null,
      totalToTlsReady: handshakeSummary.totalHandshake?.median ?? null,
    },
    pg_connect_median_ms: primary.connect?.median ?? null,
    pg_warm_query_median_ms: primary.query?.median ?? null,
    auth_and_startup_inferred_ms:
      primary.connect?.median != null && handshakeSummary.totalHandshake?.median != null
        ? +(primary.connect.median - handshakeSummary.totalHandshake.median).toFixed(3)
        : null,
  };
  console.log("\n=== DERIVED ===");
  console.log(JSON.stringify(derived, null, 2));
  fs.writeFileSync(`${OUT}/pg-ssl-derived.json`, JSON.stringify(derived, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
