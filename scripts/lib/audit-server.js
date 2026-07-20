/**
 * Bootstrap a production Next.js server for runtime audits.
 */
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const { ROOT } = require("./paths");

const PREFERRED_PORTS = Array.from({ length: 10 }, (_, i) => 3001 + i).concat([3099, 3100]);

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

function startProductionServer(port) {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  return spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production" },
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
    const child = startProductionServer(port);
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
