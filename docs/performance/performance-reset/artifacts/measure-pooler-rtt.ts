/**
 * READ-ONLY pooler RTT probe for Performance Reset.
 * Does not modify application code or schema.
 */
import fs from "fs";
import path from "path";
import pg from "pg";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  const t0 = performance.now();
  await client.connect();
  const connectMs = Math.round(performance.now() - t0);

  const samples: number[] = [];
  for (let i = 0; i < 7; i++) {
    const s = performance.now();
    await client.query("SELECT 1");
    samples.push(Math.round(performance.now() - s));
  }

  // Schema drift probe (read-only)
  let preferredLanguageExists: boolean | null = null;
  try {
    const r = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='users' AND column_name='preferred_language'`
    );
    preferredLanguageExists = (r.rowCount ?? 0) > 0;
  } catch {
    preferredLanguageExists = null;
  }

  await client.end();

  const sorted = [...samples].sort((a, b) => a - b);
  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const p50 = sorted[Math.floor((sorted.length - 1) * 0.5)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * samples.length) - 1)];

  const out = {
    capturedAt: new Date().toISOString(),
    connectMs,
    select1: { samples, min: sorted[0], avg, p50, p95, max: sorted[sorted.length - 1] },
    preferredLanguageExists,
    host: url.replace(/:[^:@]+@/, ":***@").replace(/\?.*/, ""),
  };

  const outPath = path.resolve(
    "docs/performance/performance-reset/artifacts/pooler-rtt.json"
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
