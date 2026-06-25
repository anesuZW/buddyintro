/**
 * Launch hardening validation orchestrator.
 *
 * Usage: npm run launch:validate
 * Options: --quick (shorter load test), --skip-load (skip 25 VU test)
 */
import { execSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { validateSimulationUsers } from "@/lib/simulation/validate";
import { prisma } from "@/lib/simulation/env";
import { SIM_EMAIL_DOMAIN } from "@/lib/simulation/constants";

const QUICK = process.argv.includes("--quick");
const SKIP_LOAD = process.argv.includes("--skip-load");
const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3013);

type StepResult = { name: string; ok: boolean; detail: string };

function runStep(name: string, cmd: string): StepResult {
  console.log(`\n=== ${name} ===`);
  try {
    execSync(cmd, { stdio: "inherit", shell: true, cwd: process.cwd() });
    return { name, ok: true, detail: "pass" };
  } catch (e) {
    return {
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function validateSample(size: number): Promise<StepResult> {
  const name = `${size}-user validation`;
  console.log(`\n=== ${name} ===`);
  try {
    const users = await prisma.user.count({
      where: { email: { endsWith: SIM_EMAIL_DOMAIN } },
    });
    if (users < size) {
      return { name, ok: false, detail: `Only ${users} sim users (need ${size})` };
    }
    const summary = await validateSimulationUsers({ sampleSize: size });
    const ok = summary.failed === 0 && summary.globalErrors.length === 0;
    return {
      name,
      ok,
      detail: `${summary.passed}/${summary.total} passed`,
    };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function middlewareLatencyProbe(): Promise<StepResult> {
  const name = "middleware exclusion latency";
  console.log(`\n=== ${name} ===`);
  const paths = ["/api/health", "/manifest.webmanifest", "/favicon.ico", "/robots.txt"];
  const samples: Array<{ path: string; ms: number; middlewareRan: boolean }> = [];

  for (const path of paths) {
    const start = performance.now();
    try {
      const res = await fetch(`http://localhost:${PORT}${path}`, {
        signal: AbortSignal.timeout(10_000),
      });
      await res.arrayBuffer();
      const totalHeader = Number(res.headers.get("x-auth-profile-middleware-ms") ?? 0);
      samples.push({
        path,
        ms: Math.round(performance.now() - start),
        middlewareRan: totalHeader > 0 || res.headers.has("x-auth-profile-id"),
      });
    } catch (e) {
      return {
        name,
        ok: false,
        detail: `fetch ${path} failed: ${e instanceof Error ? e.message : e}`,
      };
    }
  }

  const bad = samples.filter((s) => s.middlewareRan);
  const avgMs = Math.round(samples.reduce((s, r) => s + r.ms, 0) / samples.length);
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/.middleware-exclusion-latency.json"),
    JSON.stringify({ samples, avgMs, port: PORT }, null, 2)
  );

  return {
    name,
    ok: bad.length === 0,
    detail: bad.length
      ? `Middleware ran on: ${bad.map((b) => b.path).join(", ")}`
      : `avg ${avgMs}ms, middleware skipped on ${samples.length} paths`,
  };
}

async function main() {
  const steps: StepResult[] = [];

  steps.push(runStep("unit tests", "npm run test"));
  steps.push(
    runStep(
      "notification prefs concurrency",
      "npm run test:notification-prefs-concurrency"
    )
  );
  steps.push(runStep("user connection benchmark", "npm run benchmark:user-connections"));

  for (const size of [100, 500, 1000]) {
    steps.push(await validateSample(size));
  }

  if (!SKIP_LOAD) {
    const loadArgs = QUICK ? "--quick --skip-start" : "--skip-start";
    steps.push(
      runStep(
        "25 VU load test",
        `npm run load:concurrency -- ${loadArgs} --port=${PORT}`
      )
    );
  }

  steps.push(await middlewareLatencyProbe());

  const allPass = steps.every((s) => s.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    allPass,
    steps,
  };

  writeFileSync(
    resolve(process.cwd(), "docs/.launch-validation.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n=== Launch validation summary ===");
  for (const s of steps) {
    console.log(`${s.ok ? "PASS" : "FAIL"} — ${s.name}: ${s.detail}`);
  }

  if (!allPass) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
