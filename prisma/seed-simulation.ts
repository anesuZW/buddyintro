/**
 * Large-scale BuddyIntro simulation seed.
 *
 * Usage:
 *   npm run seed:simulation
 *   npm run seed:simulation -- --reset
 *   npm run seed:simulation -- --skip-validation
 *   npm run seed:simulation -- --validate-sample=50
 */
import { loadEnvFile, createSupabaseAdmin, deleteSimulationUsers, prisma } from "@/lib/simulation/env";
import { runSimulationSeed } from "@/lib/simulation/seed";
import { SIM_EMAIL_DOMAIN, SIM_PASSWORD, resolveTargets } from "@/lib/simulation/constants";
import { buildSimulationPlan } from "@/lib/simulation/personas";
import {
  assertRecommendationEngine,
  validateSimulationUsers,
} from "@/lib/simulation/validate";
import { runScaleBenchmarks, findSlowQueries } from "@/lib/simulation/benchmark";
import {
  collectSimulationStats,
  writePersonasArtifact,
  writeScalabilityReport,
  writeSimulationReport,
} from "@/lib/simulation/reports";

loadEnvFile();

const RESET = process.argv.includes("--reset");
const SKIP_VALIDATION = process.argv.includes("--skip-validation");
const VALIDATE_ALL = !process.argv.some((a) => a.startsWith("--validate-sample"));
const sampleArg = process.argv.find((a) => a.startsWith("--validate-sample="));
const VALIDATE_SAMPLE = sampleArg ? Number(sampleArg.split("=")[1]) : 100;
const usersArg = process.argv.find((a) => a.startsWith("--users="));
const USER_COUNT = usersArg ? Number(usersArg.split("=")[1]) : undefined;

async function main() {
  console.log("\n=== BuddyIntro Simulation Seed ===\n");
  const supabase = createSupabaseAdmin();

  if (RESET) {
    console.log("Resetting simulation data…");
    const removed = await deleteSimulationUsers(supabase);
    console.log(`  removed ${removed} simulation users (cascade)\n`);
  }

  const targets = resolveTargets(USER_COUNT);

  const { personas, communities } = buildSimulationPlan(targets.users);
  writePersonasArtifact({ personas: personas.slice(0, 50), communities, totalPersonas: personas.length, targets });

  const seed = await runSimulationSeed({
    supabase,
    db: prisma,
    skipIfPresent: !RESET,
    targets,
  });

  console.log("\nSeed counts:");
  console.log(`  users:         ${seed.users}`);
  console.log(`  stories:       ${seed.stories}`);
  console.log(`  discoveries:   ${seed.discoveries}`);
  console.log(`  messages:      ${seed.messages}`);
  console.log(`  notifications: ${seed.notifications}`);
  console.log(`  connections:   ${seed.connections}`);
  console.log(`\nLogin: sim-0${SIM_EMAIL_DOMAIN} / ${SIM_PASSWORD}`);

  let validation = {
    total: 0,
    passed: 0,
    failed: 0,
    results: [] as Awaited<ReturnType<typeof validateSimulationUsers>>["results"],
    globalErrors: [] as string[],
  };

  if (!SKIP_VALIDATION) {
    console.log(
      `\nRunning validation (${VALIDATE_ALL ? "all users" : `sample ${VALIDATE_SAMPLE}`})…`
    );
    validation = await validateSimulationUsers({
      db: prisma,
      validateAll: VALIDATE_ALL,
      sampleSize: VALIDATE_SAMPLE,
    });

    const recErrors = await assertRecommendationEngine(prisma);
    validation.globalErrors.push(...recErrors);

    if (validation.globalErrors.length) {
      validation.failed += 1;
    }

    console.log(`  passed: ${validation.passed}/${validation.total}`);
    if (validation.failed) {
      console.log(`  failed: ${validation.failed}`);
      for (const err of validation.globalErrors) console.log(`  ! ${err}`);
    }
  }

  console.log("\nRunning scalability benchmarks…");
  const benchmarks = await runScaleBenchmarks({ db: prisma });
  const stats = await collectSimulationStats(prisma);
  const slowQueries = await findSlowQueries(prisma);

  writeSimulationReport({ seed, validation, stats, slowQueries, targets });
  writeScalabilityReport(benchmarks);

  console.log("\nReports:");
  console.log("  docs/SIMULATION_REPORT.md");
  console.log("  docs/SCALABILITY_REPORT.md");

  const pass =
    validation.failed === 0 &&
    validation.globalErrors.length === 0 &&
    stats.users >= targets.users;

  console.log(`\n=== ${pass ? "PASS" : "FAIL"} ===\n`);
  if (!pass) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
