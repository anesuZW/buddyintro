/**
 * Bootstrap a production Next.js server for runtime audits.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { ROOT } = require("./paths");

const PREFERRED_PORTS = Array.from({ length: 10 }, (_, i) => 3001 + i).concat([3099, 3100]);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Merge project .env files so standalone SSR routes work during audits. */
function projectEnv(extra = {}) {
  const merged = { ...process.env };
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    Object.assign(merged, readEnvFile(path.join(ROOT, name)));
  }
  return { ...merged, ...extra };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isServerUp(base) {
  try {
    const res = await fetch(`${base}/sw.js`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port, host: "::", ipv6Only: false }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function waitForServer(base, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerUp(base)) return true;
    await sleep(1500);
  }
  return false;
}

function prepareStandaloneRuntime() {
  const standaloneDir = path.join(ROOT, ".next", "standalone");
  const serverJs = path.join(standaloneDir, "server.js");
  if (!fs.existsSync(serverJs)) {
    return null;
  }

  const targetStatic = path.join(standaloneDir, ".next", "static");
  const targetPublic = path.join(standaloneDir, "public");
  const sourceStatic = path.join(ROOT, ".next", "static");
  const sourcePublic = path.join(ROOT, "public");

  if (fs.existsSync(sourceStatic) && !fs.existsSync(targetStatic)) {
    fs.cpSync(sourceStatic, targetStatic, { recursive: true });
  }
  if (fs.existsSync(sourcePublic) && !fs.existsSync(targetPublic)) {
    fs.cpSync(sourcePublic, targetPublic, { recursive: true });
  }

  return { standaloneDir, serverJs };
}

function startProductionServer(port, auditBase) {
  const appUrl = auditBase || `http://localhost:${port}`;
  const standalone = prepareStandaloneRuntime();
  if (standalone) {
    return spawn(process.execPath, [standalone.serverJs], {
      cwd: standalone.standaloneDir,
      env: projectEnv({
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: "localhost",
        NEXT_PUBLIC_APP_URL: appUrl,
      }),
      stdio: "pipe",
    });
  }

  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  console.warn("⚠ Standalone build missing — falling back to `next start` (run npm run build for production parity)");
  return spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "localhost"], {
    cwd: ROOT,
    env: projectEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: appUrl }),
    stdio: "pipe",
  });
}

async function stopServer(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await sleep(2000);
  try {
    child.kill("SIGKILL");
  } catch {
    /* ignore */
  }
}

/**
 * Ensure a production server is reachable; start one if needed.
 * By default starts a fresh server so static assets match the latest build.
 */
async function ensureProductionServer(options = {}) {
  const reuseExisting = options.reuseExisting ?? process.env.AUDIT_REUSE_SERVER === "1";
  const preferred = options.port ?? (process.env.AUDIT_PORT ? Number(process.env.AUDIT_PORT) : undefined);
  const candidates = preferred
    ? [preferred, ...PREFERRED_PORTS.filter((p) => p !== preferred)]
    : PREFERRED_PORTS;

  if (reuseExisting) {
    for (const port of candidates) {
      const base = `http://localhost:${port}`;
      if (await isServerUp(base)) {
        return { base, child: null, started: false, port };
      }
    }
  }

  for (const port of candidates) {
    if (!(await isPortFree(port))) continue;

    const base = `http://localhost:${port}`;
    const child = startProductionServer(port, base);
    child.stdout?.on("data", (d) => process.stdout.write(d));
    child.stderr?.on("data", (d) => process.stderr.write(d));

    const ready = await waitForServer(base, options.timeoutMs ?? 90_000);
    if (ready) {
      return { base, child, started: true, port };
    }

    await stopServer(child);
  }

  throw new Error(`No audit server available (ports ${candidates.join(", ")})`);
}

module.exports = {
  PREFERRED_PORTS,
  ensureProductionServer,
  isPortFree,
  isServerUp,
  startProductionServer,
  stopServer,
  waitForServer,
};
